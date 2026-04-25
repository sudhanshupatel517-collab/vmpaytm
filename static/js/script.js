document.addEventListener('DOMContentLoaded', () => {
    const productCards = document.querySelectorAll('.product-card');
    
    // Cart Bar Elements
    const cartBar = document.getElementById('cart-bar');
    const cartTotalItems = document.getElementById('cart-total-items');
    const cartTotalPrice = document.getElementById('cart-total-price');
    const btnViewCart = document.getElementById('btn-view-cart');
    
    // Cart Panel Elements
    const cartPanelOverlay = document.getElementById('cart-panel-overlay');
    const btnCloseCart = document.getElementById('btn-close-cart');
    const cartItemsList = document.getElementById('cart-items-list');
    const panelTotalPrice = document.getElementById('panel-total-price');
    const btnTotal = document.getElementById('btn-total');
    const btnCheckout = document.getElementById('btn-checkout');
    
    // UI Feedback Elements
    const toast = document.getElementById('toast');
    const overlay = document.getElementById('state-overlay');
    const overlayIcon = document.getElementById('overlay-icon');
    const overlayTitle = document.getElementById('overlay-title');
    const overlaySubtitle = document.getElementById('overlay-subtitle');

    let cart = {}; // Object mapping id -> {name, price, icon, qty}
    let isProcessing = false;
    let toastTimeout;

    const showToast = (msg) => {
        toast.textContent = msg;
        toast.classList.remove('hidden', 'fade-out');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 2000);
    };

    // Update the main product cards grid based on cart state
    const updateGridUI = () => {
        productCards.forEach(card => {
            const id = card.getAttribute('data-id');
            const addBtn = card.querySelector('.add-btn');
            const qtyControl = card.querySelector('.qty-control');
            const qtyText = card.querySelector('.qty-text');
            
            const qty = cart[id] ? cart[id].qty : 0;
            if (qty === 0) {
                addBtn.classList.remove('hidden');
                qtyControl.classList.add('hidden');
                card.classList.remove('active-card');
            } else {
                addBtn.classList.add('hidden');
                qtyControl.classList.remove('hidden');
                qtyText.textContent = qty;
                card.classList.add('active-card');
            }
        });
    };

    // Render items inside the cart panel
    const renderCartPanel = () => {
        cartItemsList.innerHTML = '';
        Object.keys(cart).forEach(id => {
            if (cart[id].qty > 0) {
                const item = cart[id];
                const el = document.createElement('div');
                el.className = 'panel-cart-item';
                el.innerHTML = `
                    <div class="panel-cart-item-info">
                        <div class="panel-cart-item-icon">${item.icon}</div>
                        <div>
                            <div class="panel-cart-item-name">${item.name}</div>
                            <div class="panel-cart-item-price">₹${item.price} / item</div>
                        </div>
                    </div>
                    <div class="panel-cart-controls">
                        <div class="panel-qty-control">
                            <button class="panel-minus" data-id="${id}">−</button>
                            <span>${item.qty}</span>
                            <button class="panel-plus" data-id="${id}">+</button>
                        </div>
                        <button class="panel-remove-btn" data-id="${id}">✖</button>
                    </div>
                `;
                cartItemsList.appendChild(el);
            }
        });

        // Add event listeners to panel buttons
        document.querySelectorAll('.panel-minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                if (cart[id] && cart[id].qty > 0) {
                    cart[id].qty--;
                    if (cart[id].qty === 0) {
                        delete cart[id];
                        showToast("Item removed");
                    }
                    updateCartUI();
                }
            });
        });

        document.querySelectorAll('.panel-plus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                if (cart[id] && cart[id].qty < 4) {
                    cart[id].qty++;
                    updateCartUI();
                } else {
                    showToast(`Maximum 4 allowed`);
                }
            });
        });

        document.querySelectorAll('.panel-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                delete cart[id];
                showToast("Item removed");
                updateCartUI();
            });
        });
    };

    // Master function to sync all UI (grid, cart bar, panel)
    const updateCartUI = () => {
        let totalQty = 0;
        let totalPrice = 0;
        let cartArray = [];

        Object.keys(cart).forEach(id => {
            if (cart[id].qty > 0) {
                totalQty += cart[id].qty;
                totalPrice += cart[id].price * cart[id].qty;
                cartArray.push({ item_id: id, quantity: cart[id].qty });
            }
        });

        // Update Bottom Bar
        if (totalQty === 0) {
            cartBar.classList.add('hidden');
            cartPanelOverlay.classList.add('hidden'); // Close panel if empty
        } else {
            cartBar.classList.remove('hidden');
            cartTotalItems.textContent = `${totalQty} Item${totalQty > 1 ? 's' : ''}`;
            cartTotalPrice.textContent = `₹${totalPrice}`;
            btnTotal.textContent = `₹${totalPrice}`;
            panelTotalPrice.textContent = `₹${totalPrice}`;
        }

        updateGridUI();
        renderCartPanel();
        
        return cartArray;
    };

    // Overlay state manager
    const setOverlayState = (state, message = '', subtitle = '') => {
        if (state === 'hidden') {
            overlay.classList.add('hidden');
            return;
        }
        overlay.classList.remove('hidden');
        overlayTitle.textContent = message;
        overlaySubtitle.textContent = subtitle;

        if (state === 'loading') overlayIcon.innerHTML = '<div class="loader"></div>';
        else if (state === 'success') overlayIcon.innerHTML = '✅';
        else if (state === 'error') overlayIcon.innerHTML = '❌';
        else if (state === 'dispensing') overlayIcon.innerHTML = '⚙️';
    };

    // Initialize Card Listeners on the Grid
    productCards.forEach(card => {
        const id = card.getAttribute('data-id');
        const name = card.getAttribute('data-name');
        const price = parseInt(card.getAttribute('data-price'));
        const icon = card.getAttribute('data-icon');
        
        const addBtn = card.querySelector('.add-btn');
        const minusBtn = card.querySelector('.minus-btn');
        const plusBtn = card.querySelector('.plus-btn');

        addBtn.addEventListener('click', () => {
            if (isProcessing) return;
            cart[id] = { name, price, icon, qty: 1 };
            showToast(`${name} added to cart`);
            updateCartUI();
        });

        minusBtn.addEventListener('click', () => {
            if (isProcessing) return;
            if (cart[id] && cart[id].qty > 0) {
                cart[id].qty--;
                if (cart[id].qty === 0) {
                    delete cart[id];
                    showToast("Item removed");
                }
                updateCartUI();
            }
        });

        plusBtn.addEventListener('click', () => {
            if (isProcessing) return;
            if (cart[id] && cart[id].qty < 4) {
                cart[id].qty++;
                updateCartUI();
            } else if (cart[id] && cart[id].qty >= 4) {
                showToast(`Maximum 4 allowed`);
            }
        });
    });

    // Cart Panel Toggling
    btnViewCart.addEventListener('click', () => {
        if (Object.keys(cart).length > 0) {
            cartPanelOverlay.classList.remove('hidden');
        }
    });

    btnCloseCart.addEventListener('click', () => {
        cartPanelOverlay.classList.add('hidden');
    });

    cartPanelOverlay.addEventListener('click', (e) => {
        // Close if clicking outside the panel
        if (e.target === cartPanelOverlay) {
            cartPanelOverlay.classList.add('hidden');
        }
    });

    // Checkout Flow
    btnCheckout.addEventListener('click', async () => {
        const cartArray = updateCartUI();
        if (isProcessing || cartArray.length === 0) return;
        
        const termsCheckbox = document.getElementById('terms-checkbox');
        if (!termsCheckbox.checked) {
            alert("Please agree to the Privacy Policy & Terms before paying.");
            return;
        }

        isProcessing = true;
        btnCheckout.classList.add('disabled');
        cartPanelOverlay.classList.add('hidden'); // Hide panel during checkout
        setOverlayState('loading', 'Creating Order...', 'Please wait');

        try {
            const orderRes = await fetch('/api/create_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cart: cartArray })
            });
            const orderData = await orderRes.json();
            
            if (!orderRes.ok || orderData.status !== 'success') {
                throw new Error(orderData.message || 'Failed to create order.');
            }

            setOverlayState('hidden');

            const options = {
                "key": orderData.key,
                "amount": orderData.amount,
                "currency": "INR",
                "name": "SmartVending",
                "description": `Instamart Checkout`,
                "order_id": orderData.order_id,
                "handler": async function (response) {
                    setOverlayState('loading', 'Processing payment...', 'Verifying securely...');
                    
                    const verifyPromise = fetch('/api/verify_payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            cart: cartArray,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature
                        })
                    });

                    let totalItems = 0;
                    cartArray.forEach(c => totalItems += c.quantity);
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('TIMEOUT')), 15000 + (totalItems * 3000));
                    });

                    try {
                        const verifyRes = await Promise.race([verifyPromise, timeoutPromise]);
                        const verifyData = await verifyRes.json();
                        if (verifyRes.ok && verifyData.status === 'success') {
                            setOverlayState('dispensing', 'Payment successful!', `Dispensing ${totalItems} items...`);
                            setTimeout(() => {
                                setOverlayState('success', 'Please collect your items', 'Thank you!');
                                setTimeout(() => {
                                    isProcessing = false;
                                    btnCheckout.classList.remove('disabled');
                                    cart = {}; // Clear cart
                                    updateCartUI();
                                    setOverlayState('hidden');
                                }, 4000);
                            }, totalItems * 3000); 
                        } else {
                            throw new Error(verifyData.message || 'Verification failed.');
                        }
                    } catch (err) {
                        setOverlayState('error', 'Payment Failed', err.message === 'TIMEOUT' ? 'Taking too long.' : err.message);
                        setTimeout(() => { isProcessing = false; btnCheckout.classList.remove('disabled'); setOverlayState('hidden'); }, 4000);
                    }
                },
                "theme": { "color": "#3b82f6" },
                "modal": {
                    "ondismiss": function() {
                        isProcessing = false;
                        btnCheckout.classList.remove('disabled');
                        setOverlayState('hidden');
                    }
                }
            };
            const rzp = new Razorpay(options);
            rzp.on('payment.failed', function (response){
                setOverlayState('error', 'Payment Failed', response.error.description);
                setTimeout(() => { isProcessing = false; btnCheckout.classList.remove('disabled'); setOverlayState('hidden'); }, 4000);
            });
            rzp.open();

        } catch (error) {
            setOverlayState('error', 'Connection Error', error.message);
            setTimeout(() => { isProcessing = false; btnCheckout.classList.remove('disabled'); setOverlayState('hidden'); }, 4000);
        }
    });
});
