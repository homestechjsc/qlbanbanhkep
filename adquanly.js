// Khởi tạo Firebase SDK v8 với dự án Realtime Database "db-banhca"
const firebaseConfig = {
    apiKey: "AIzaSyCLOMjeC-gBOcB_z8916Q3v6TeKUa4mqQI",
    authDomain: "db-banhca.firebaseapp.com",
    databaseURL: "https://db-banhca-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "db-banhca",
    storageBucket: "db-banhca.firebasestorage.app",
    messagingSenderId: "43723555660",
    appId: "1:43723555660:web:bcc491d88c925acc07c5e9",
    measurementId: "G-GJ0XJ4M410"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

function cafeApp() {
    return {
        // ================= TRẠNG THÁI CHÍNH & TÀI KHOẢN =================
        currentTab: 'tables',
        currentUser: JSON.parse(localStorage.getItem('pos_mobile_user') || 'null'),
        loginForm: { username: '', pin: '' },
        currentShift: JSON.parse(localStorage.getItem('pos_mobile_shift') || 'null'),
        
        storeSettings: {
            storeName: 'Bánh Kẹp Nóng Giòn',
            address: 'Takeaway Kiot',
            phone: '0972.023.222',
            paperSize: '80mm',
            showQrPayment: true,
            bankCode: 'MB',
            bankAccount: '0972023222',
            bankAccountName: 'BANH KEP'
        },

        // Dữ liệu Bánh & Khuôn
        activeCategory: 'Tất cả',
        searchQuery: '',
        categories: ['Tất cả', 'Bánh kẹp mặn', 'Bánh kẹp ngọt', 'Nước uống'],
        menuItems: [],
        tables: [], 
        areas: ['Khuôn 1', 'Khuôn 2'], 
        selectedAreaFilter: 'Khuôn 1',
        selectedTable: null,
        tableOrders: {},
        currentOrder: { items: [] },

        // Modals & Forms
        paymentMethod: 'Tiền mặt',
        ordersList: [],
        cashFlowList: [],
        staffList: [],
        showPaymentModal: false,
        showAreaModal: false,
        showMenuModal: false,
        isEditingMenu: false,
        newAreaName: '',
        menuForm: { id: null, name: '', price: 20000, category: 'Bánh kẹp mặn', image: '' },
        openShiftForm: { initialCash: 200000, shiftName: 'Ca Bán Mang Về', note: '' },

        // ================= CHẾ ĐỘ THANH TOÁN GỘP =================
        isMultiCheckoutMode: false,
        selectedSlotsForCheckout: [],
        showMultiPaymentModal: false,

        // ================= KHỞI TẠO DỮ LIỆU REALTIME =================
        init() {
            // 1. Tải danh sách nhân viên từ Firebase
            db.ref('staff').on('value', snap => {
                const d = snap.val();
                this.staffList = d ? Object.keys(d).map(k => ({ id: k, ...d[k] })) : [];
            });

            // 2. Thực đơn
            db.ref('menu').on('value', snap => {
                const d = snap.val();
                if (d) {
                    this.menuItems = Object.keys(d).map(k => ({ id: k, ...d[k] }));
                } else {
                    const sampleItems = [
                        { name: 'Bánh kẹp Patê Chà bông', price: 20000, category: 'Bánh kẹp mặn' },
                        { name: 'Bánh kẹp Phô mai Bắp', price: 22000, category: 'Bánh kẹp mặn' },
                        { name: 'Bánh kẹp Trứng muối Chà bông', price: 25000, category: 'Bánh kẹp mặn' },
                        { name: 'Bánh kẹp Bơ sữa Lá dứa', price: 18000, category: 'Bánh kẹp ngọt' },
                        { name: 'Bánh kẹp Socola Chuối', price: 20000, category: 'Bánh kẹp ngọt' }
                    ];
                    sampleItems.forEach(it => db.ref('menu').push(it));
                }
            });

            // 3. Danh sách Khuôn máy
            db.ref('areas').on('value', snap => {
                const d = snap.val();
                if (d && Array.isArray(d)) {
                    this.areas = d;
                } else if (d && typeof d === 'object') {
                    this.areas = Object.values(d);
                } else {
                    db.ref('areas').set(this.areas);
                }
                if (!this.areas.includes(this.selectedAreaFilter) && this.areas.length > 0) {
                    this.selectedAreaFilter = this.areas[0];
                }
            });

            // 4. Sơ đồ 6 Vị trí kẹp của từng khuôn
            db.ref('tables').on('value', snap => {
                const d = snap.val();
                if (d) {
                    this.tables = Object.keys(d).map(k => ({ id: k, ...d[k] }));
                } else {
                    this.resetMoldSlotsForArea('Khuôn 1');
                    this.resetMoldSlotsForArea('Khuôn 2');
                }
            });

            // 5. Món đang kẹp ở từng vị trí
            db.ref('tableOrders').on('value', snap => {
                this.tableOrders = snap.val() || {};
                if (this.selectedTable) {
                    this.currentOrder.items = this.tableOrders[this.selectedTable.id] || [];
                }
            });

            // 6. Đơn hàng hoàn thành
            db.ref('orders').on('value', snap => {
                const d = snap.val();
                this.ordersList = d ? Object.keys(d).map(k => ({ id: k, ...d[k] })) : [];
            });

            // 7. Sổ quỹ thu chi
            db.ref('cashFlow').on('value', snap => {
                const d = snap.val();
                this.cashFlowList = d ? Object.keys(d).map(k => ({ id: k, ...d[k] })) : [];
            });
        },

        // ================= XÁC THỰC TÀI KHOẢN TỪ BẢNG STAFF =================
        login() {
            const u = (this.loginForm.username || '').trim().toLowerCase();
            const p = String(this.loginForm.pin || '').trim();

            if (!u || !p) {
                alert('Vui lòng nhập đầy đủ Tên đăng nhập và Mã PIN!');
                return;
            }

            if (u === 'admin' && p === '1234') {
                this.currentUser = { id: 'admin', name: 'Quản Trị Viên', role: 'Quản lý', username: 'admin' };
                localStorage.setItem('pos_mobile_user', JSON.stringify(this.currentUser));
                this.loginForm = { username: '', pin: '' };
                return;
            }

            db.ref('staff').once('value', snap => {
                const list = snap.val() ? Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })) : [];
                const staff = list.find(s => String(s.username).trim().toLowerCase() === u && String(s.pin).trim() === p);

                if (staff) {
                    this.currentUser = {
                        id: staff.id,
                        name: staff.name,
                        role: staff.role || 'Thu ngân',
                        username: staff.username
                    };
                    localStorage.setItem('pos_mobile_user', JSON.stringify(this.currentUser));
                    this.loginForm = { username: '', pin: '' };
                    alert(`Đăng nhập thành công! Chào ${staff.name} (${staff.role})`);
                } else {
                    alert('Tên đăng nhập hoặc mã PIN không chính xác! Hãy liên hệ Quản lý.');
                }
            });
        },

        logout() {
            if (confirm('Bạn có chắc chắn muốn đăng xuất tài khoản này?')) {
                this.currentUser = null;
                localStorage.removeItem('pos_mobile_user');
            }
        },

        hasPermission(allowedRoles = []) {
            if (!this.currentUser) return false;
            if (this.currentUser.role === 'Quản lý' || this.currentUser.username === 'admin') return true;
            return allowedRoles.includes(this.currentUser.role);
        },

        // ================= HÀM HỖ TRỢ TẠO 6 VỊ TRÍ KẸP CHUẨN =================
        resetMoldSlotsForArea(moldName) {
            const slotDescriptions = [
                'Vị trí #1 (Trên - Trái)',
                'Vị trí #2 (Trên - Giữa)',
                'Vị trí #3 (Trên - Phải)',
                'Vị trí #4 (Dưới - Trái)',
                'Vị trí #5 (Dưới - Giữa)',
                'Vị trí #6 (Dưới - Phải)'
            ];

            slotDescriptions.forEach(desc => {
                const newRef = db.ref('tables').push();
                newRef.set({
                    id: newRef.key,
                    name: desc,
                    area: moldName,
                    status: 'empty'
                });
            });
        },

        resetCurrentMoldSlots() {
            if (confirm(`Bạn có muốn tạo lại 6 vị trí chuẩn cho "${this.selectedAreaFilter}"?`)) {
                const currentSlots = this.tables.filter(t => t.area === this.selectedAreaFilter);
                currentSlots.forEach(s => db.ref('tables/' + s.id).remove());
                this.resetMoldSlotsForArea(this.selectedAreaFilter);
            }
        },

        switchTab(tabId) {
            this.currentTab = tabId;
        },

        get filteredTables() {
            return this.tables.filter(t => t.area === this.selectedAreaFilter);
        },

        get filteredMenu() {
            let items = this.menuItems;
            if (this.activeCategory !== 'Tất cả') items = items.filter(i => i.category === this.activeCategory);
            if (this.searchQuery.trim() !== '') items = items.filter(i => i.name.toLowerCase().includes(this.searchQuery.toLowerCase()));
            return items;
        },

        // ================= THAO TÁC KẸP BÁNH LẺ & GỘP =================
        handleSlotClick(slot) {
            this.selectTable(slot);
            if (slot.status !== 'serving') {
                this.currentTab = 'pos';
            }
        },

        handleCheckoutSlot(slot) {
            this.selectTable(slot);
            this.openPaymentModal();
        },

        selectTable(slot) {
            this.selectedTable = slot;
            this.currentOrder.items = this.tableOrders[slot.id] || [];
        },

        addToOrder(item) {
            if (!this.selectedTable) {
                alert('Vui lòng chọn 1 vị trí kẹp trên khuôn trước!');
                this.currentTab = 'tables';
                return;
            }
            let existing = this.currentOrder.items.find(i => i.name === item.name);
            if (existing) existing.qty++;
            else this.currentOrder.items = [{ ...item, qty: 1 }];
            
            this.tableOrders[this.selectedTable.id] = [...this.currentOrder.items];
            db.ref('tableOrders/' + this.selectedTable.id).set(this.currentOrder.items);
        },

        // Tăng / Giảm / Xóa bánh khi bấm nhầm
        updateCurrentQty(change) {
            if (this.currentOrder.items.length === 0) return;
            this.currentOrder.items[0].qty += change;
            if (this.currentOrder.items[0].qty <= 0) {
                this.clearCurrentOrder();
                return;
            }
            if (this.selectedTable) {
                this.tableOrders[this.selectedTable.id] = [...this.currentOrder.items];
            }
        },

        clearCurrentOrder() {
            this.currentOrder.items = [];
            if (this.selectedTable) {
                delete this.tableOrders[this.selectedTable.id];
                db.ref('tableOrders/' + this.selectedTable.id).remove();
            }
        },

        subTotal() {
            return this.currentOrder.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
        },

        finalTotal() {
            return this.subTotal();
        },

        saveTableOrder() {
            if (!this.selectedTable) return;
            db.ref('tables/' + this.selectedTable.id).update({ status: 'serving' });
            db.ref('tableOrders/' + this.selectedTable.id).set(this.currentOrder.items);
            this.currentTab = 'tables';
        },

        // ================= THANH TOÁN LẺ 1 BÁNH =================
        openPaymentModal() {
            if (!this.selectedTable || this.currentOrder.items.length === 0) {
                alert('Vị trí kẹp này hiện chưa có bánh!');
                return;
            }
            this.paymentMethod = 'Tiền mặt';
            this.showPaymentModal = true;
        },

        getVietQrUrl(amount = 0, note = '') {
            if (!this.storeSettings.bankCode || !this.storeSettings.bankAccount) return '';
            const desc = encodeURIComponent(note || 'Banh kep');
            return `https://img.vietqr.io/image/${this.storeSettings.bankCode}-${this.storeSettings.bankAccount}-compact2.png?amount=${amount}&addInfo=${desc}&accountName=${encodeURIComponent(this.storeSettings.bankAccountName)}`;
        },

        confirmCheckout() {
            if (!this.selectedTable || this.currentOrder.items.length === 0) return;

            const newOrderRef = db.ref('orders').push();
            const orderData = {
                id: newOrderRef.key,
                table: `${this.selectedTable.area} - ${this.selectedTable.name}`,
                items: [...this.currentOrder.items],
                total: this.finalTotal(),
                paymentMethod: this.paymentMethod,
                cashier: this.currentUser ? this.currentUser.name : 'Thu ngân',
                timestamp: new Date().toISOString()
            };

            newOrderRef.set(orderData);
            db.ref('tables/' + this.selectedTable.id).update({ status: 'empty' });
            db.ref('tableOrders/' + this.selectedTable.id).remove();

            this.showPaymentModal = false;
            this.selectedTable = null;
            this.currentOrder.items = [];
            this.currentTab = 'tables';
        },

        // ================= LOGIC THANH TOÁN GỘP =================
        toggleMultiCheckoutMode() {
            this.isMultiCheckoutMode = !this.isMultiCheckoutMode;
            this.selectedSlotsForCheckout = [];
        },

        toggleSlotSelection(slotId) {
            const idx = this.selectedSlotsForCheckout.indexOf(slotId);
            if (idx > -1) {
                this.selectedSlotsForCheckout.splice(idx, 1);
            } else {
                this.selectedSlotsForCheckout.push(slotId);
            }
        },

        get multiCheckoutItems() {
            let allItems = [];
            this.selectedSlotsForCheckout.forEach(slotId => {
                const items = this.tableOrders[slotId] || [];
                items.forEach(it => {
                    allItems.push({ ...it, fromSlotId: slotId });
                });
            });
            return allItems;
        },

        get multiCheckoutTotal() {
            return this.multiCheckoutItems.reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.qty || 1)), 0);
        },

        openMultiPaymentModal() {
            if (this.selectedSlotsForCheckout.length === 0) {
                alert("Vui lòng chọn ít nhất 1 vị trí kẹp đang nướng!");
                return;
            }
            this.paymentMethod = 'Tiền mặt';
            this.showMultiPaymentModal = true;
        },

        confirmMultiCheckout() {
            if (this.selectedSlotsForCheckout.length === 0) return;

            const newOrderRef = db.ref('orders').push();
            const orderData = {
                id: newOrderRef.key,
                table: `Đơn gộp (${this.selectedSlotsForCheckout.length} vị trí)`,
                items: [...this.multiCheckoutItems],
                total: this.multiCheckoutTotal,
                paymentMethod: this.paymentMethod,
                cashier: this.currentUser ? this.currentUser.name : 'Thu ngân',
                timestamp: new Date().toISOString()
            };

            newOrderRef.set(orderData);

            // Làm trống toàn bộ các kẹp đã chọn
            this.selectedSlotsForCheckout.forEach(slotId => {
                db.ref('tables/' + slotId).update({ status: 'empty' });
                db.ref('tableOrders/' + slotId).remove();
            });

            this.selectedSlotsForCheckout = [];
            this.isMultiCheckoutMode = false;
            this.showMultiPaymentModal = false;
            alert("Đã thu tiền gộp và làm trống toàn bộ các kẹp thành công!");
        },

        // ================= SỔ QUỸ =================
        openCashFlowModal(type) {
            const amount = prompt(`Nhập số tiền ${type === 'THU' ? 'thu' : 'chi'}:`);
            if (!amount || isNaN(amount)) return;
            const note = prompt("Nội dung ghi chú:");

            db.ref('cashFlow').push({
                type: type,
                category: type === 'THU' ? 'Thu khác' : 'Mua nguyên liệu/Bột',
                amount: Number(amount),
                note: note || '',
                timestamp: new Date().toISOString()
            });
        },

        get filteredCashFlowList() {
            return [...this.cashFlowList].reverse();
        },

        get totalAutoPosIncome() {
            return this.ordersList.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        },

        get totalManualIncome() {
            return this.cashFlowList.filter(c => c.type === 'THU').reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
        },

        get totalExpenses() {
            return this.cashFlowList.filter(c => c.type === 'CHI').reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
        },

        get filteredOrdersList() {
            return [...this.ordersList].reverse();
        }
    };
}
