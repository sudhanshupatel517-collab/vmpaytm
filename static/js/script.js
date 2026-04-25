document.addEventListener('DOMContentLoaded', () => {
    const kioskItems = document.querySelectorAll('.kiosk-item');
    const cartBar = document.getElementById('cart-bar');
    const cartIcon = document.getElementById('cart-icon');
    const cartName = document.getElementById('cart-name');
    const cartUnitPrice = document.getElementById('cart-unit-price');
    const cartQtyDisplay = document.getElementById('cart-qty');
    const cartTotalDisplay = document.getElementById('cart-total');
    
    const btnRemoveCart = document.getElementById('btn-remove-cart');
    const btnQtyMinus = document.getElementById('btn-qty-minus');
    const btnQtyPlus = document.getElementById('btn-qty-plus');
    const btnCheckout = document.getElementById('btn-checkout');

    const overlay = document.getElementById('state-overlay');
    const overlayIcon = document.getElementById('overlay-icon');
    const overlayTitle = document.getElementById('overlay-title');
    const overlaySubtitle = document.getElementById('overlay-subtitle');

    let currentItem = null;
    let currentQty = 1;
    let isProcessing = false;

    // UI Updates
    const updateCartUI = () => {
        if (!currentItem) {
            cartBar.classList.add('hidden');
            kioskItems.forEach(item => {
                item.classList.remove('active');
                item.querySelector('.item-check').classList.add('hidden');
            });
            return;
        }

        cartBar.classList.remove('hidden');
        cartIcon.textContent = currentItem.icon;
        cartName.textContent = currentItem.name;
        cartUnitPrice.textContent = `₹${currentItem.price}`;
        cartQtyDisplay.textContent = currentQty;
        cartTotalDisplay.textContent = `₹${currentItem.price * currentQty}`;

        if (currentQty >= 2) {
            btnQtyPlus.classList.add('disabled');
        } else {
            btnQtyPlus.classList.remove('disabled');
        }

        if (currentQty <= 1) {
            btnQtyMinus.classList.add('disabled');
        } else {
            btnQtyMinus.classList.remove('disabled');
        }

        kioskItems.forEach(item => {
            if (item.getAttribute('data-id') === currentItem.id) {
                item.classList.add('active');
                item.querySelector('.item-check').classList.remove('hidden');
            } else {
                item.classList.remove('active');
                item.querySelector('.item-check').classList.add('hidden');
            }
        });
    };

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

    // Event Listeners
    kioskItems.forEach(item => {
        item.addEventListener('click', () => {
            if (isProcessing) return;
            currentItem = {
                id: item.getAttribute('data-id'),
                name: item.getAttribute('data-name'),
                price: parseInt(item.getAttribute('data-price')),
                icon: item.getAttribute('data-icon')
            };
            currentQty = 1;
            updateCartUI();
        });
    });

    btnRemoveCart.addEventListener('click', () => {
        if (isProcessing) return;
        currentItem = null;
        updateCartUI();
    });

    btnQtyMinus.addEventListener('click', () => {
        if (isProcessing || currentQty <= 1) return;
        currentQty--;
        updateCartUI();
    });

    btnQtyPlus.addEventListener('click', () => {
        if (isProcessing || currentQty >= 2) return;
        currentQty++;
        updateCartUI();
    });

    // Checkout Flow
    btnCheckout.addEventListener('click', async () => {
        if (isProcessing || !currentItem) return;
        
        const termsCheckbox = document.getElementById('terms-checkbox');
        if (!termsCheckbox.checked) {
            alert("Please agree to the Privacy Policy, Terms & Conditions, and Refund Policy before making a payment.");
            return;
        }

        isProcessing = true;
        setOverlayState('loading', 'Creating Order...', 'Please wait');

        try {
            // 1. Create Order
            const orderRes = await fetch('/api/create_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: currentItem.id, quantity: currentQty })
            });

            const orderData = await orderRes.json();

            if (!orderRes.ok || orderData.status !== 'success') {
                throw new Error(orderData.message || 'Failed to create order.');
            }

            setOverlayState('hidden');

            // 2. Open Razorpay Checkout
            const options = {
                "key": orderData.key,
                "amount": orderData.amount,
                "currency": "INR",
                "name": "Smart Vending Kiosk",
                "description": `Purchase ${currentQty}x ${orderData.name}`,
                "order_id": orderData.order_id,
                "handler": async function (response) {
                    setOverlayState('loading', 'Processing payment...', 'Verifying securely with backend');
                    
                    // 3. Verify Payment
                    const verifyPromise = fetch('/api/verify_payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            item_id: currentItem.id,
                            quantity: currentQty,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature
                        })
                    });

                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('TIMEOUT')), 15000); // 15s timeout for multi-dispense
                    });

                    try {
                        const verifyRes = await Promise.race([verifyPromise, timeoutPromise]);
                        const verifyData = await verifyRes.json();
                        
                        if (verifyRes.ok && verifyData.status === 'success') {
                            setOverlayState('dispensing', 'Payment successful!', `Dispensing ${currentQty} items...`);
                            // Wait for hardware drops (approx 3s per item)
                            setTimeout(() => {
                                setOverlayState('success', 'Please collect your items', 'Thank you for your purchase!');
                                setTimeout(() => {
                                    isProcessing = false;
                                    currentItem = null;
                                    updateCartUI();
                                    setOverlayState('hidden');
                                }, 4000);
                            }, currentQty * 3000); 
                        } else {
                            throw new Error(verifyData.message || 'Verification failed.');
                        }
                    } catch (err) {
                        console.error(err);
                        setOverlayState('error', 'Payment verification failed', err.message === 'TIMEOUT' ? 'Taking too long.' : 'Please contact support.');
                        setTimeout(() => {
                            is:Processing = false;
                            setOverlayState('hidden');
                        }, 5000);
                    }
                },
                "theme": { "color": "#4f46e5" },
                "modal": {
                    "ondismiss": function() {
                        isProcessing = false;
                        setOverlayState('hidden');
                    }
                }
            };
            
            const rzp = new Razorpay(options);
            rzp.on('payment.failed', function (response){
                setOverlayState('error', 'Payment Failed', response.error.description);
                setTimeout(() => {
                    isProcessing = false;
                    setOverlayState('hidden');
                }, 5000);
            });
            rzp.open();

        } catch (error) {
            console.error('Error:', error);
            setOverlayState('error', 'Connection Error', error.message);
            setTimeout(() => {
                isProcessing = false;
                setOverlayState('hidden');
            }, 4000);
        }
    });
});
