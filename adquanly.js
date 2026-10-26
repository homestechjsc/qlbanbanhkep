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
            storeName: 'Bánh Cá Nướng Taiyaki',
            address: 'Takeaway Kiot',
            phone: '0906255788',
            paperSize: '80mm',
            showQrPayment: true,
            bankCode: 'VPB',
            bankAccount: '393931968688',
            bankAccountName: 'LUONG THI THANH HOAI'
        },

        // Dữ liệu Bánh & Khuôn
        activeCategory: 'Tất cả',
        searchQuery: '',
        categories: ['Tất cả', 'Bánh mặn', 'Bánh ngọt', 'Nước uống'],
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

        // Quản lý Sổ Quỹ (Form chuyên nghiệp)
        showCashFlowModal: false,
        isEditingCashFlow: false,
        cashFlowForm: { id: null, type: 'CHI', category: 'Mua nguyên liệu/Bột', amount: 50000, recipient: '', note: '' },
        expenseCategories: [
            'Mua nguyên liệu/Bột',
            'Mua hộp / Túi / Bao bì',
            'Tiền Gas / Điện nướng bánh',
            'Lương / Thưởng nhân viên',
            'Sửa chữa máy / Khuôn nướng',
            'Chi phí mặt bằng / Kiot',
            'Chi tiêu khác'
        ],
        incomeCategories: [
            'Thu bán bánh ngoài POS',
            'Chủ quán góp thêm vốn vào quỹ',
            'Thu hoàn tiền nhà cung cấp',
            'Thu nhập khác'
        ],

        // Quản lý ca làm việc & Modal xác nhận đăng xuất
        showOpenShiftModal: false,
        showCloseShiftModal: false,
        showLogoutConfirmModal: false, // Hộp thoại xử lý đột xuất khi đăng xuất
        openShiftForm: { shiftName: 'Ca 1 (Sáng)', initialCash: 200000, note: '' },
        closeShiftForm: { actualCash: 0, note: '' },

        // Chế độ thanh toán gộp
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

            // 8. Đồng bộ ca hiện tại của tài khoản đang đăng nhập
            if (this.currentUser) {
                db.ref('currentShifts/' + this.currentUser.username).on('value', snap => {
                    const shiftData = snap.val();
                    if (shiftData) {
                        this.currentShift = shiftData;
                        localStorage.setItem('pos_mobile_shift', JSON.stringify(shiftData));
                    } else {
                        // Nếu trên cloud không còn ca (đã kết ca từ nơi khác), làm mới ở máy khách
                        this.currentShift = null;
                        localStorage.removeItem('pos_mobile_shift');
                    }
                });
            }
        },

        // ================= XÁC THỰC TÀI KHOẢN TỪ BẢNG STAFF =================
        login() {
            const u = (this.loginForm.username || '').trim().toLowerCase();
            const p = String(this.loginForm.pin || '').trim();

            if (!u || !p) {
                alert('Vui lòng nhập đầy đủ Tên đăng nhập và Mã PIN!');
                return;
            }

            // Tài khoản Quản trị Admin khẩn cấp
            if (u === 'admin' && p === '1234') {
                this.currentUser = { id: 'admin', name: 'Quản Trị Viên', role: 'Quản lý', username: 'admin' };
                localStorage.setItem('pos_mobile_user', JSON.stringify(this.currentUser));
                this.loginForm = { username: '', pin: '' };
                this.currentTab = 'tables';
                this.restoreExistingShift(u);
                return;
            }

            db.ref('staff').once('value', snap => {
                const list = snap.val() ? Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })) : [];
                const staff = list.find(s => String(s.username).trim().toLowerCase() === u && String(s.pin).trim() === p);

                if (staff) {
                    this.currentUser = {
                        id: staff.id,
                        name: staff.name,
                        role: String(staff.role || 'Thu ngân').trim(),
                        username: staff.username
                    };
                    localStorage.setItem('pos_mobile_user', JSON.stringify(this.currentUser));
                    this.loginForm = { username: '', pin: '' };
                    this.currentTab = 'tables';
                    
                    // Phục hồi lại ca đang bán dở nếu trước đó đăng xuất đột xuất
                    this.restoreExistingShift(staff.username);
                } else {
                    alert('Tên đăng nhập hoặc mã PIN không chính xác! Hãy liên hệ Quản lý.');
                }
            });
        },

        // Phục hồi ca đang bán nếu có ca lưu trên Firebase
        restoreExistingShift(username) {
            db.ref('currentShifts/' + username).once('value', snap => {
                const activeShift = snap.val();
                if (activeShift) {
                    this.currentShift = activeShift;
                    localStorage.setItem('pos_mobile_shift', JSON.stringify(activeShift));
                    alert(`Chào mừng trở lại! Hệ thống đã phục hồi lại "${activeShift.shiftName}" bạn đang bán dở.`);
                } else {
                    this.currentShift = null;
                    localStorage.removeItem('pos_mobile_shift');
                }
            });
        },

        // ================= XỬ LÝ ĐĂNG XUẤT ĐỘT XUẤT KHI CHƯA KẾT CA =================
        logout() {
            // Nếu ca làm việc vẫn đang mở -> Bật hộp thoại hỏi rõ kết ca hay tạm thoát
            if (this.currentShift) {
                this.showLogoutConfirmModal = true;
                return;
            }
            // Nếu không có ca thì đăng xuất ngay
            this.forceLogoutNow();
        },

        // Tùy chọn 1: Bấm để Kết ca luôn trước khi thoát
        logoutAndCloseShift() {
            this.showLogoutConfirmModal = false;
            this.openCloseShiftModalFunc();
        },

        // Tùy chọn 2: Tạm thoát ra nhưng GIỮ NGUYÊN CA LÀM VIỆC trên Firebase
        logoutAndKeepShift() {
            this.showLogoutConfirmModal = false;
            // Chỉ xóa thông tin đăng nhập tạm của user trên máy, giữ ca trên Firebase
            this.currentUser = null;
            this.currentShift = null;
            localStorage.removeItem('pos_mobile_user');
            localStorage.removeItem('pos_mobile_shift');
            alert('Đã đăng xuất tạm thời! Ca làm việc của bạn vẫn được lưu giữ an toàn.');
        },

        // Đăng xuất hoàn toàn khi không có ca
        forceLogoutNow() {
            this.currentUser = null;
            this.currentShift = null;
            localStorage.removeItem('pos_mobile_user');
            localStorage.removeItem('pos_mobile_shift');
        },

        hasPermission(allowedRoles = []) {
            if (!this.currentUser) return false;
            const userRole = String(this.currentUser.role || '').trim().toLowerCase();
            const userName = String(this.currentUser.username || '').trim().toLowerCase();

            if (userRole === 'quản lý' || userRole === 'quan ly' || userName === 'admin') {
                return true;
            }

            const normalizedAllowed = allowedRoles.map(r => String(r).trim().toLowerCase());
            return normalizedAllowed.includes(userRole);
        },

        switchTab(tabId) {
            if (tabId === 'cashflow' && !this.hasPermission(['Quản lý'])) {
                alert('Mục này chỉ dành cho tài khoản Quản lý!');
                return;
            }
            this.currentTab = tabId;
        },

        // ================= HÀM CHỐT CHẶN BẮT BUỘC MỞ CA (CHỐNG THẤT THOÁT) =================
        ensureShiftOpened() {
            if (this.hasPermission(['Quản lý'])) {
                return true;
            }

            if (!this.currentShift) {
                alert('⚠️ BẮT BUỘC MỞ CA:\nBạn chưa mở ca làm việc! Vui lòng bấm "Mở Ca" ở góc trên màn hình để khai báo tiền thối đầu ca trước khi bán bánh.');
                this.openOpenShiftModalFunc();
                return false;
            }
            return true;
        },

        // ================= QUẢN LÝ CA LÀM VIỆC =================
        openOpenShiftModalFunc() {
            if (!this.currentUser) {
                alert('Vui lòng đăng nhập trước khi mở ca!');
                return;
            }
            this.openShiftForm.initialCash = 200000;
            this.openShiftForm.note = '';
            this.showOpenShiftModal = true;
        },

        confirmOpenShift() {
            if (!this.currentUser) return;

            this.currentShift = {
                id: 'SHIFT_' + Date.now(),
                shiftName: this.openShiftForm.shiftName,
                cashier: this.currentUser.name,
                username: this.currentUser.username,
                startTime: new Date().toISOString(),
                initialCash: Number(this.openShiftForm.initialCash) || 0,
                note: this.openShiftForm.note || ''
            };

            localStorage.setItem('pos_mobile_shift', JSON.stringify(this.currentShift));
            db.ref('currentShifts/' + this.currentUser.username).set(this.currentShift);

            alert(`Mở ca "${this.currentShift.shiftName}" thành công! Thu ngân: ${this.currentUser.name}`);
            this.showOpenShiftModal = false;
        },

        get shiftStats() {
            if (!this.currentShift) {
                return { ordersCount: 0, cashIncome: 0, bankIncome: 0, systemExpectedCash: 0 };
            }

            const shiftStart = new Date(this.currentShift.startTime).getTime();
            
            const ordersInShift = this.ordersList.filter(o => {
                if (!o.timestamp) return false;
                const orderTime = new Date(o.timestamp).getTime();
                const isMyOrder = (o.cashier === this.currentShift.cashier) || (o.cashierUsername === this.currentShift.username);
                return orderTime >= shiftStart && isMyOrder;
            });

            const cashIncome = ordersInShift
                .filter(o => o.paymentMethod === 'Tiền mặt')
                .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

            const bankIncome = ordersInShift
                .filter(o => o.paymentMethod !== 'Tiền mặt')
                .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

            const expectedCash = (Number(this.currentShift.initialCash) || 0) + cashIncome;

            return {
                ordersCount: ordersInShift.length,
                cashIncome: cashIncome,
                bankIncome: bankIncome,
                systemExpectedCash: expectedCash
            };
        },

        openCloseShiftModalFunc() {
            if (!this.currentShift) {
                alert('Hiện tại chưa có ca làm việc nào đang mở!');
                return;
            }
            this.closeShiftForm.actualCash = this.shiftStats.systemExpectedCash;
            this.closeShiftForm.note = '';
            this.showCloseShiftModal = true;
        },

        confirmCloseShift() {
            const stats = this.shiftStats;
            const actualCash = Number(this.closeShiftForm.actualCash) || 0;
            const diff = actualCash - stats.systemExpectedCash;

            const shiftReport = {
                ...this.currentShift,
                endTime: new Date().toISOString(),
                cashRevenue: stats.cashIncome,
                bankRevenue: stats.bankIncome,
                expectedCash: stats.systemExpectedCash,
                actualCash: actualCash,
                difference: diff,
                ordersCount: stats.ordersCount,
                closeNote: this.closeShiftForm.note || ''
            };

            // Lưu báo cáo kết ca lên Firebase
            db.ref('shiftsHistory').push(shiftReport);
            
            // Xóa ca đang mở trên Firebase
            if (this.currentUser) {
                db.ref('currentShifts/' + this.currentUser.username).remove();
            }

            alert(`Kết ca thành công!\n- Tiền thực tế: ${actualCash.toLocaleString()}đ\n- Chênh lệch: ${(diff >= 0 ? '+' : '') + diff.toLocaleString()}đ\nHệ thống sẽ đăng xuất để nhân viên ca sau vào làm việc.`);

            this.currentShift = null;
            this.currentUser = null;
            localStorage.removeItem('pos_mobile_shift');
            localStorage.removeItem('pos_mobile_user');
            this.showCloseShiftModal = false;
        },

        // ================= LỊCH SỬ ĐƠN HÀNG: CHỈ HIỂN THỊ ĐÚNG TRONG CA =================
        get filteredOrdersList() {
            if (this.hasPermission(['Quản lý'])) {
                return [...this.ordersList].reverse();
            }

            if (!this.currentShift) {
                return [];
            }

            const shiftStart = new Date(this.currentShift.startTime).getTime();
            return this.ordersList.filter(o => {
                if (!o.timestamp) return false;
                const orderTime = new Date(o.timestamp).getTime();
                const isMyOrder = (o.cashier === this.currentShift.cashier) || 
                                  (o.cashierUsername === this.currentShift.username);
                return orderTime >= shiftStart && isMyOrder;
            }).reverse();
        },

        // ================= QUẢN LÝ SỔ QUỸ =================
        openCashFlowModal(type = 'CHI') {
            this.isEditingCashFlow = false;
            this.cashFlowForm = {
                id: null,
                type: type,
                category: type === 'CHI' ? this.expenseCategories[0] : this.incomeCategories[0],
                amount: 50000,
                recipient: '',
                note: ''
            };
            this.showCashFlowModal = true;
        },

        openEditCashFlowModal(flow) {
            this.isEditingCashFlow = true;
            this.cashFlowForm = {
                id: flow.id,
                type: flow.type || 'CHI',
                category: flow.category || this.expenseCategories[0],
                amount: Number(flow.amount || 0),
                recipient: flow.recipient || '',
                note: flow.note || '',
                timestamp: flow.timestamp
            };
            this.showCashFlowModal = true;
        },

        saveCashFlow() {
            const form = this.cashFlowForm;
            if (!form.amount || Number(form.amount) <= 0) {
                alert('Vui lòng nhập số tiền hợp lệ (> 0)!');
                return;
            }

            const payload = {
                type: form.type,
                category: form.category,
                amount: Number(form.amount),
                recipient: (form.recipient || '').trim(),
                note: (form.note || '').trim(),
                creator: this.currentUser ? this.currentUser.name : 'Quản lý',
                timestamp: this.isEditingCashFlow && form.timestamp ? form.timestamp : new Date().toISOString()
            };

            if (this.isEditingCashFlow && form.id) {
                db.ref('cashFlow/' + form.id).update(payload).then(() => {
                    alert('Đã cập nhật lại phiếu thu/chi thành công!');
                    this.showCashFlowModal = false;
                }).catch(err => alert('Lỗi: ' + err.message));
            } else {
                db.ref('cashFlow').push(payload).then(() => {
                    alert(`Đã lưu phiếu ${payload.type === 'THU' ? 'thu' : 'chi'} thành công!`);
                    this.showCashFlowModal = false;
                }).catch(err => alert('Lỗi: ' + err.message));
            }
        },

        deleteCashFlow(id) {
            if (confirm('Bạn có chắc chắn muốn xóa phiếu thu/chi này khỏi sổ quỹ?')) {
                db.ref('cashFlow/' + id).remove().then(() => {
                    alert('Đã xóa phiếu thành công!');
                }).catch(err => alert('Lỗi: ' + err.message));
            }
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

        // ================= QUẢN LÝ THỰC ĐƠN =================
        openMenuModal() {
            this.isEditingMenu = false;
            this.menuForm = { id: null, name: '', price: 20000, category: 'Bánh kẹp mặn', image: '' };
            this.showMenuModal = true;
        },

        openEditMenuModal(m) {
            this.isEditingMenu = true;
            this.menuForm = {
                id: m.id,
                name: m.name || '',
                price: Number(m.price || 0),
                category: m.category || 'Bánh kẹp mặn',
                image: m.image || ''
            };
            this.showMenuModal = true;
        },

        saveMenu() {
            if (!this.menuForm.name || !this.menuForm.name.trim()) {
                alert('Vui lòng nhập tên món bánh!');
                return;
            }

            const payload = {
                name: this.menuForm.name.trim(),
                price: Number(this.menuForm.price) || 0,
                category: this.menuForm.category || 'Bánh kẹp mặn',
                image: (this.menuForm.image || '').trim()
            };

            if (this.isEditingMenu && this.menuForm.id) {
                db.ref('menu/' + this.menuForm.id).update(payload).then(() => {
                    alert('Cập nhật món bánh thành công!');
                    this.showMenuModal = false;
                });
            } else {
                db.ref('menu').push(payload).then(() => {
                    alert('Thêm món bánh mới thành công!');
                    this.showMenuModal = false;
                });
            }
        },

        deleteMenuItem(id) {
            if (confirm('Bạn có chắc chắn muốn xóa món bánh này khỏi thực đơn?')) {
                db.ref('menu/' + id).remove().then(() => {
                    alert('Đã xóa món thành công!');
                });
            }
        },

        // ================= QUẢN LÝ KHUÔN NƯỚNG =================
        openAreaManageModal() {
            this.newAreaName = '';
            this.showAreaModal = true;
        },

        addNewArea() {
            const moldName = this.newAreaName.trim();
            if (!moldName) {
                alert('Vui lòng nhập tên khuôn!');
                return;
            }

            if (this.areas.includes(moldName)) {
                alert('Tên khuôn này đã tồn tại!');
                return;
            }

            const updatedAreas = [...this.areas, moldName];
            db.ref('areas').set(updatedAreas).then(() => {
                this.areas = updatedAreas;
                this.newAreaName = '';
                this.resetMoldSlotsForArea(moldName);
                alert(`Đã thêm khuôn "${moldName}" và khởi tạo sẵn 6 vị trí kẹp!`);
            });
        },

        deleteArea(areaName) {
            const hasServingSlot = this.tables.some(t => t.area === areaName && t.status === 'serving');
            if (hasServingSlot) {
                alert(`Khuôn "${areaName}" đang có bánh đang nướng, không thể xóa lúc này!`);
                return;
            }

            if (confirm(`Bạn có chắc muốn xóa "${areaName}" và tất cả vị trí kẹp của khuôn này?`)) {
                const updatedAreas = this.areas.filter(a => a !== areaName);
                db.ref('areas').set(updatedAreas).then(() => {
                    this.areas = updatedAreas;
                    this.tables.filter(t => t.area === areaName).forEach(s => db.ref('tables/' + s.id).remove());
                    
                    if (this.selectedAreaFilter === areaName && this.areas.length > 0) {
                        this.selectedAreaFilter = this.areas[0];
                    }
                    alert(`Đã xóa "${areaName}" thành công!`);
                });
            }
        },

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
                alert(`Đã làm mới 6 vị trí kẹp cho "${this.selectedAreaFilter}"!`);
            }
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
            if (!this.ensureShiftOpened()) return;
            this.selectTable(slot);
            if (slot.status !== 'serving') {
                this.currentTab = 'pos';
            }
        },

        handleCheckoutSlot(slot) {
            if (!this.ensureShiftOpened()) return;
            this.selectTable(slot);
            this.openPaymentModal();
        },

        selectTable(slot) {
            this.selectedTable = slot;
            this.currentOrder.items = this.tableOrders[slot.id] || [];
        },

        addToOrder(item) {
            if (!this.ensureShiftOpened()) return;
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
            if (!this.ensureShiftOpened()) return;
            if (!this.selectedTable) return;
            db.ref('tables/' + this.selectedTable.id).update({ status: 'serving' });
            db.ref('tableOrders/' + this.selectedTable.id).set(this.currentOrder.items);
            this.currentTab = 'tables';
        },

        // ================= THANH TOÁN =================
        openPaymentModal() {
            if (!this.ensureShiftOpened()) return;
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
                cashierUsername: this.currentUser ? this.currentUser.username : '',
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
            if (!this.ensureShiftOpened()) return;
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
            if (!this.ensureShiftOpened()) return;
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
                cashierUsername: this.currentUser ? this.currentUser.username : '',
                timestamp: new Date().toISOString()
            };

            newOrderRef.set(orderData);

            this.selectedSlotsForCheckout.forEach(slotId => {
                db.ref('tables/' + slotId).update({ status: 'empty' });
                db.ref('tableOrders/' + slotId).remove();
            });

            this.selectedSlotsForCheckout = [];
            this.isMultiCheckoutMode = false;
            this.showMultiPaymentModal = false;
            alert("Đã thu tiền gộp và làm trống toàn bộ các kẹp thành công!");
        }
    };
}
