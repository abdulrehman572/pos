function app() {
    return {
        sidebarOpen: false,
        currentPage: 'billing',
        pageContent: '',
        // Shared data (reactive)
        dashboard: { todaySalesTotal: 0, lowStockCount: 0, totalDues: 0, lowStock: [] },
        bill: { search: '', searchResults: [], cart: [], total: 0, paymentMethod: 'cash', amountPaid: 0, loanCustomerId: '', statusMessage: '', statusType: '' },
        purchase: { supplierId: '', selectedProductId: '', quantity: 1, items: [], total: 0, statusMessage: '', statusType: '' },
        khata: { selectedCustomer: null, ledger: [], paymentAmount: 0, statusMessage: '', statusType: '' },
        allProducts: [], suppliers: [], customers: [],
        productsStatusMessage: '', productsStatusType: '',
        monthlyProfit: 0, stockSummary: { totalStockValue: 0, totalItems: 0 }, reportDateFrom: new Date().toISOString().slice(0,10), reportDateTo: new Date().toISOString().slice(0,10), dateRangeSales: { totalSales: 0, profit: 0 },
        settings: { shopName: 'Kiryana Store', gst: '', lowStockThreshold: 10, barcodeScannerEnabled: false, printerEnabled: false,
                backup: { enabled: false, frequency: 'daily', custom: '', location: '' } },
        settingsStatusMessage: '', settingsStatusType: '',
        productModal: { open: false, editing: false, form: {}, currentId: null, statusMessage: '', statusType: '' },
        customerModal: { open: false, form: {}, statusMessage: '', statusType: '', returnContext: null }, supplierModal: { open: false, form: {}, statusMessage: '', statusType: '' },
        eventSource: null,

        async init() {
            await this.loadAllProducts();
            await this.loadSuppliers();
            await this.loadCustomers();
            await this.loadDashboard();
            await this.loadReports();
            await this.loadSettings();
            this.startSSE();
            document.addEventListener('keydown', (e) => {
                if (this.currentPage === 'billing' && this.settings.barcodeScannerEnabled && e.key === 'Enter') {
                    let code = this.bill.search.trim();
                    if (code) this.barcodeScanned(code);
                }
            });
            // Load initial page
            await this.loadPage('billing');
            await this.loadModals();
        },

        async loadPage(page) {
            const res = await fetch(`/partials/${page}.html`);
            if (res.ok) {
                this.pageContent = await res.text();
                this.currentPage = page;
                // Re‑bind any page‑specific Alpine components if needed (but x-data already shared)
            }
        },

        async loadModals() {
            const res = await fetch('/partials/modals.html');
            if (res.ok) {
                document.getElementById('modals-container').innerHTML = await res.text();
            }
        },

        showStatus(context, message, type) {
            if (context === 'bill') { this.bill.statusMessage = message; this.bill.statusType = type; setTimeout(() => { this.bill.statusMessage = ''; }, 3000); }
            else if (context === 'purchase') { this.purchase.statusMessage = message; this.purchase.statusType = type; setTimeout(() => { this.purchase.statusMessage = ''; }, 3000); }
            else if (context === 'khata') { this.khata.statusMessage = message; this.khata.statusType = type; setTimeout(() => { this.khata.statusMessage = ''; }, 3000); }
            else if (context === 'products') { this.productsStatusMessage = message; this.productsStatusType = type; setTimeout(() => { this.productsStatusMessage = ''; }, 3000); }
            else if (context === 'settings') { this.settingsStatusMessage = message; this.settingsStatusType = type; setTimeout(() => { this.settingsStatusMessage = ''; }, 3000); }
            else if (context === 'productModal') { this.productModal.statusMessage = message; this.productModal.statusType = type; setTimeout(() => { this.productModal.statusMessage = ''; }, 3000); }
            else if (context === 'customerModal') { this.customerModal.statusMessage = message; this.customerModal.statusType = type; setTimeout(() => { this.customerModal.statusMessage = ''; }, 3000); }
            else if (context === 'supplierModal') { this.supplierModal.statusMessage = message; this.supplierModal.statusType = type; setTimeout(() => { this.supplierModal.statusMessage = ''; }, 3000); }
        },

        async fetchJSON(url, options = {}) {
            try {
                const res = await fetch(url, options);
                if (!res.ok) throw new Error(await res.text());
                return await res.json();
            } catch(e) { this.showStatus('bill', e.message, 'error'); return null; }
        },

        async loadAllProducts() { let data = await this.fetchJSON('/api/products?limit=1000'); if(data) this.allProducts = data; },
        async loadSuppliers() { let data = await this.fetchJSON('/api/suppliers'); if(data) this.suppliers = data; },
        async loadCustomers() { let data = await this.fetchJSON('/api/customers'); if(data) this.customers = data; },
        async loadDashboard() {
            let low = await this.fetchJSON('/api/products?lowStock=true'); if(low) { this.dashboard.lowStock = low; this.dashboard.lowStockCount = low.length; }
            let sales = await this.fetchJSON('/api/reports/daily-sales'); if(sales) this.dashboard.todaySalesTotal = sales.totalSales;
            let cust = await this.fetchJSON('/api/customers'); if(cust) this.dashboard.totalDues = cust.reduce((s,c)=>s+(c.balance||0),0);
        },
        async loadReports() {
            let pnl = await this.fetchJSON('/api/reports/monthly-pnl'); if(pnl) this.monthlyProfit = pnl.profit;
            let stock = await this.fetchJSON('/api/reports/stock-summary'); if(stock) this.stockSummary = stock;
            await this.loadDateRangeReports();
        },
        async loadDateRangeReports() { if (!this.reportDateFrom || !this.reportDateTo) return; let data = await this.fetchJSON(`/api/reports/date-range-sales?from=${this.reportDateFrom}&to=${this.reportDateTo}`); if(data) this.dateRangeSales = data; },
        async loadSettings() {
            let shop = await fetch('/api/settings/shopName').then(r=>r.text()).catch(()=>'Kiryana Store');
            let gst = await fetch('/api/settings/gst').then(r=>r.text()).catch(()=>'');
            let thresh = await fetch('/api/settings/lowStockThreshold').then(r=>parseInt(r.text())).catch(()=>10);
            let scanner = await fetch('/api/settings/barcodeScannerEnabled').then(r=>r.text() === 'true').catch(()=>false);
            let printer = await fetch('/api/settings/printerEnabled').then(r=>r.text() === 'true').catch(()=>false);
            // load backup settings
            let backupEnabled = await fetch('/api/settings/backupEnabled').then(r=>r.text()).catch(()=> 'false');
            let backupFrequency = await fetch('/api/settings/backupFrequency').then(r=>r.text()).catch(()=> 'daily');
            let backupLocation = await fetch('/api/settings/backupLocation').then(r=>r.text()).catch(()=> '');
            let backupCustom = await fetch('/api/settings/backupCustom').then(r=>r.text()).catch(()=> '');

            this.settings = { shopName: shop, gst, lowStockThreshold: thresh, barcodeScannerEnabled: scanner, printerEnabled: printer,
                              backup: { enabled: backupEnabled === 'true', frequency: backupFrequency || 'daily', custom: backupCustom || '', location: backupLocation || '' } };
        },
        startSSE() {
            this.eventSource = new EventSource('/api/events');
            this.eventSource.onmessage = (e) => { try { let d = JSON.parse(e.data); if (d.type === 'new-sale' || d.type === 'stock_update') { this.loadDashboard(); this.loadAllProducts(); } } catch(e) {} };
            this.eventSource.onerror = () => { if (this.eventSource) this.eventSource.close(); setTimeout(() => this.startSSE(), 5000); };
        },
        searchProducts() { let q = this.bill.search.trim().toLowerCase(); if (!q) { this.bill.searchResults = []; return; } this.bill.searchResults = this.allProducts.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q)).slice(0,20); },
        barcodeScanned(code) { let product = this.allProducts.find(p => p.barcode === code); if (product) this.addToCart(product); else this.showStatus('bill', 'Product not found', 'error'); this.bill.search = ''; },
        async addToCart(p) {
            // Check expiry if present
            if (p.expiryDate) {
                const exp = new Date(p.expiryDate);
                const now = new Date();
                if (exp < now) {
                    this.showStatus('bill', 'Item appears expired and cannot be added to cart. Remove or restock it first.', 'error');
                    return;
                }
            }
            if (p.stock <= 0) return this.showStatus('bill', 'Out of stock', 'error');
            let ex = this.bill.cart.find(i=>i.id===p.id);
            if(ex) ex.quantity++;
            else this.bill.cart.push({...p, quantity:1});
            this.updateTotal();
        },
        updateQuantity(idx, delta) { let q = this.bill.cart[idx].quantity + delta; if (q <= 0) this.bill.cart.splice(idx,1); else this.bill.cart[idx].quantity = q; this.updateTotal(); },
        removeFromCart(idx) { this.bill.cart.splice(idx,1); this.updateTotal(); },
        updateTotal() { this.bill.total = this.bill.cart.reduce((s,i)=>s+(i.sellingPrice*i.quantity),0); },
        async completeSale() {
            if (!this.bill.cart.length) return this.showStatus('bill', 'Cart empty', 'error');
            let amountPaid = this.bill.amountPaid || 0;
            let loanAmount = 0;
            if (this.bill.paymentMethod === 'loan') amountPaid = 0, loanAmount = this.bill.total;
            else if (amountPaid < this.bill.total) loanAmount = this.bill.total - amountPaid;
            if (loanAmount > 0 && !this.bill.loanCustomerId) return this.showStatus('bill', 'Select customer for loan', 'error');
            // Allow per-item unit price override (unitPrice stored as `unitPrice` on cart item)
            let payload = { items: this.bill.cart.map(i=>({productId:i.id, quantity:i.quantity, sellingPrice:i.unitPrice ?? i.sellingPrice})), paymentMethod: this.bill.paymentMethod, amountPaid, loanAmount, customerId: loanAmount ? this.bill.loanCustomerId : null };
            let res = await fetch('/api/sales', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
            if (!res.ok) {
                const text = await res.text();
                return this.showStatus('bill', `Sale failed: ${text}`, 'error');
            }
            let result = await res.json();
            this.showStatus('bill', `✅ Sale #${result.id} completed!`, 'success');
            this.bill.cart = []; this.bill.total = 0; this.bill.amountPaid = 0; this.bill.search = ''; this.bill.loanCustomerId = '';
            await this.loadDashboard(); await this.loadAllProducts();
        },

        // Price override is shown inline because browser dialogs are disabled
        async setPriceForItem(idx) {
            const item = this.bill.cart[idx];
            if (!item) return;
            this.showStatus('bill', 'Price override cannot be entered via browser prompt in this mode. Use the cart item editor instead.', 'error');
        },
        addPurchaseItem() {
            let prod = this.allProducts.find(p=>p.id == this.purchase.selectedProductId);
            if (!prod) return this.showStatus('purchase', 'Select product', 'error');
            let qty = parseInt(this.purchase.quantity) || 1;
            let existing = this.purchase.items.find(i=>i.id===prod.id);
            if (existing) existing.quantity += qty;
            else this.purchase.items.push({id:prod.id, name:prod.name, purchasePrice:prod.purchasePrice, quantity:qty});
            this.purchase.total = this.purchase.items.reduce((s,i)=>s+(i.purchasePrice*i.quantity),0);
            this.purchase.selectedProductId = ''; this.purchase.quantity = 1;
        },
        async completePurchase() {
            if (!this.purchase.supplierId) return this.showStatus('purchase', 'Select supplier', 'error');
            if (!this.purchase.items.length) return this.showStatus('purchase', 'Add items', 'error');
            let payload = { supplierId: this.purchase.supplierId, items: this.purchase.items.map(i=>({productId:i.id, quantity:i.quantity, purchasePrice:i.purchasePrice})) };
            let res = await fetch('/api/purchases', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
            if (!res.ok) return this.showStatus('purchase', 'Purchase failed', 'error');
            this.showStatus('purchase', 'Purchase recorded & stock updated', 'success');
            this.purchase.items = []; this.purchase.total = 0; this.purchase.supplierId = '';
            await this.loadAllProducts();
        },
        openProductModalForPurchase() { this.productModal.editing = false; this.productModal.form = { name:'', barcode:'', purchasePrice:0, sellingPrice:0, stock:0, lowStockThreshold:10 }; this.productModal.open = true; },
        openSupplierModal() { this.supplierModal.form = {}; this.supplierModal.open = true; },
        async saveSupplier() {
            let res = await fetch('/api/suppliers', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(this.supplierModal.form) });
            if (!res.ok) {
                const txt = await res.text();
                try { const json = JSON.parse(txt); if (res.status === 409 && json.existing) {
                    this.supplierModal.form = json.existing;
                    this.supplierModal.open = true;
                    return this.showStatus('supplierModal', 'Supplier already exists. Loaded existing record for editing.', 'error');
                } }
                catch(e){}
                return this.showStatus('purchase', `Failed to add supplier: ${txt}`, 'error');
            }
            this.showStatus('purchase', 'Supplier added', 'success');
            this.supplierModal.open = false; await this.loadSuppliers();
        },
        openCustomerModal() { this.customerModal.form = {}; this.customerModal.open = true; },
        async saveCustomer() {
            let res = await fetch('/api/customers', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(this.customerModal.form) });
            if (!res.ok) {
                const txt = await res.text();
                try { const json = JSON.parse(txt); if (res.status === 409 && json.existing) {
                    this.customerModal.form = json.existing;
                    this.customerModal.open = true;
                    return this.showStatus('customerModal', 'Customer already exists. Loaded existing record for editing.', 'error');
                } }
                catch(e){}
                return this.showStatus('khata', `Failed to add customer: ${txt}`, 'error');
            }
            this.showStatus('khata', 'Customer added', 'success');
            this.customerModal.open = false; await this.loadCustomers();
        },
        async loadCustomerLedger() { if (!this.khata.selectedCustomer) return; let data = await this.fetchJSON(`/api/payments/customer/${this.khata.selectedCustomer}/ledger`); if(data) this.khata.ledger = data; },
        async recordPayment() {
            if (!this.khata.selectedCustomer || !this.khata.paymentAmount) return this.showStatus('khata', 'Select customer and amount', 'error');
            let res = await fetch('/api/payments/customer', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ customerId: this.khata.selectedCustomer, amount: this.khata.paymentAmount }) });
            if (!res.ok) return this.showStatus('khata', 'Payment failed', 'error');
            this.showStatus('khata', 'Payment recorded', 'success');
            this.khata.paymentAmount = 0;
            await this.loadCustomerLedger(); await this.loadCustomers();
        },
        openProductModal() { this.productModal.editing = false; this.productModal.form = { name:'', barcode:'', purchasePrice:0, sellingPrice:0, stock:0, lowStockThreshold:10 }; this.productModal.open = true; },
        editProduct(p) { this.productModal.editing = true; this.productModal.currentId = p.id; this.productModal.form = {...p}; this.productModal.open = true; },
        async saveProduct() {
            let url = this.productModal.editing ? `/api/products/${this.productModal.currentId}` : '/api/products';
            let method = this.productModal.editing ? 'PUT' : 'POST';
            let res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(this.productModal.form) });
            if (!res.ok) {
                const txt = await res.text();
                try { const json = JSON.parse(txt); if (res.status === 409 && json.existing) {
                    this.productModal.form = json.existing;
                    this.productModal.editing = true;
                    this.productModal.currentId = json.existing.id;
                    this.productModal.open = true;
                    return this.showStatus('productModal', 'Product already exists. Loaded existing record for editing.', 'error');
                } }
                catch(e){}
                return this.showStatus('products', `Save failed: ${txt}`, 'error');
            }
            this.showStatus('products', 'Product saved', 'success');
            this.productModal.open = false; await this.loadAllProducts();
        },
        async deleteProduct(id) { await fetch(`/api/products/${id}`, { method:'DELETE' }); await this.loadAllProducts(); this.showStatus('products', 'Deleted', 'success'); },
        async saveSettings() {
            await fetch('/api/settings/shopName', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({value:this.settings.shopName}) });
            await fetch('/api/settings/gst', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({value:this.settings.gst}) });
            await fetch('/api/settings/lowStockThreshold', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({value:this.settings.lowStockThreshold.toString()}) });
            await fetch('/api/settings/barcodeScannerEnabled', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({value:this.settings.barcodeScannerEnabled.toString()}) });
            await fetch('/api/settings/printerEnabled', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({value:this.settings.printerEnabled.toString()}) });
            // Backup settings
            try {
                await fetch('/api/settings/backupEnabled', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({value:this.settings.backup.enabled.toString()}) });
                await fetch('/api/settings/backupFrequency', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({value:this.settings.backup.frequency}) });
                await fetch('/api/settings/backupLocation', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({value:this.settings.backup.location || ''}) });
                await fetch('/api/settings/backupCustom', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({value:this.settings.backup.custom || ''}) });
            } catch(e) { /* non-blocking */ }
            this.showStatus('settings', 'Settings saved', 'success');
        },

        chooseBackupLocation(e) {
            const files = e.target.files;
            if (!files || !files.length) return;
            // webkitRelativePath gives path relative to the chosen folder; use that to infer folder name
            const first = files[0];
            let folder = '';
            if (first.webkitRelativePath) folder = first.webkitRelativePath.split('/')[0];
            else folder = first.name;
            this.settings.backup.location = folder;
            this.saveSettings();
        },
        printReport() { window.print(); }
    };
}