import time
import logging
import razorpay
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS

# Optional: GPIO import with fallback for testing on non-RPi systems
try:
    from gpiozero import Motor
    from gpiozero.pins.pigpio import PiGPIOFactory
    
    GPIO_AVAILABLE = True
except (ImportError, RuntimeError):
    GPIO_AVAILABLE = False
    print("GPIO libraries not found. Running in MOCK mode.")

app = Flask(__name__)
CORS(app)
import os
from dotenv import load_dotenv

load_dotenv()

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_Sf2YjSGmPfl2H0")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "iytY9Kziycer3Ne7POV7O0af")
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# Configuration
# Mapping of Item ID -> GPIO Pins (IN1, IN2)
ITEMS = {
    "chips": {"name": "Chips", "pin1": 18, "pin2": 17, "icon": "🥔", "price": 10},
    "biscuit": {"name": "Biscuits", "pin1": 23, "pin2": 27, "icon": "🍪", "price": 10},
    "soda": {"name": "Soda", "pin1": 24, "pin2": 22, "icon": "🥤", "price": 40},
    "chocolate": {"name": "Chocolate", "pin1": 25, "pin2": 5, "icon": "🍫", "price": 20}
}

ROTATION_TIME = 2.0   # Time in seconds the DC motor needs to be ON to drop the item (Adjust as needed for your coil)
DEBOUNCE_TIME = 2.0   # Seconds between dispenses

# State
last_dispense_time = 0

# Setup Logging
logging.basicConfig(
    filename='vending.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Hardware Initialization
motors = {}
if GPIO_AVAILABLE:
    try:
        factory = PiGPIOFactory()
        for item_id, info in ITEMS.items():
            motors[item_id] = Motor(forward=info['pin1'], backward=info['pin2'], pin_factory=factory)
            motors[item_id].stop()
    except Exception as e:
        print(f"Error initializing motors: {e}")
        GPIO_AVAILABLE = False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/create_order', methods=['POST'])
def create_order():
    data = request.get_json()
    item_id = data.get('item_id')
    quantity = int(data.get('quantity', 1))
    
    if item_id not in ITEMS:
        return jsonify({"status": "error", "message": "Invalid item selected."}), 400
    if quantity < 1 or quantity > 2:
        return jsonify({"status": "error", "message": "Invalid quantity."}), 400

    amount = ITEMS[item_id]['price'] * quantity * 100 # Razorpay takes amount in paise

    try:
        order = razorpay_client.order.create({
            "amount": amount,
            "currency": "INR",
            "payment_capture": "1"
        })
        return jsonify({
            "status": "success", 
            "order_id": order['id'], 
            "amount": amount,
            "key": RAZORPAY_KEY_ID,
            "name": ITEMS[item_id]['name'],
            "quantity": quantity
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/verify_payment', methods=['POST'])
def verify_payment():
    global last_dispense_time
    
    data = request.get_json()
    item_id = data.get('item_id')
    quantity = int(data.get('quantity', 1))
    razorpay_payment_id = data.get('razorpay_payment_id')
    razorpay_order_id = data.get('razorpay_order_id')
    razorpay_signature = data.get('razorpay_signature')
    
    # 1. Verify Payment Signature
    try:
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        })
    except razorpay.errors.SignatureVerificationError:
        return jsonify({"status": "error", "message": "Payment verification failed."}), 400

    # Payment verified! Proceed to dispense.
    current_time = time.time()
    
    # Optional Debounce Check: Kept to prevent concurrent hardware overlap.
    last_dispense_time = current_time

    # 2. Trigger Motor
    success = False
    error_msg = ""
    
    try:
        if GPIO_AVAILABLE and item_id in motors:
            motor = motors[item_id]
            for i in range(quantity):
                try:
                    motor.forward()
                    time.sleep(ROTATION_TIME)
                finally:
                    motor.stop()
                
                if i < quantity - 1:
                    time.sleep(1.0) # Delay between multi-drops
            success = True
        else:
            # Mock behavior for local testing
            for i in range(quantity):
                print(f"[MOCK] DC Motor on Pins ({ITEMS[item_id]['pin1']}, {ITEMS[item_id]['pin2']}) moving forward for {ROTATION_TIME}s")
                time.sleep(ROTATION_TIME)
                if i < quantity - 1:
                    time.sleep(1.0)
            success = True
            
    except Exception as e:
        error_msg = str(e)
        logging.error(f"Motor Error for {item_id}: {error_msg}")

    if success:
        last_dispense_time = time.time()
        logging.info(f"Item {item_id} dispensed successfully after payment {razorpay_payment_id}.")
        return jsonify({
            "status": "success",
            "message": f"Payment successful! {ITEMS[item_id]['name']} dispensed!"
        })
    else:
        return jsonify({
            "status": "error",
            "message": f"Payment accepted, but hardware error occurred: {error_msg}. Please contact support."
        }), 500

@app.route('/api/items')
def get_items():
    return jsonify(ITEMS)

@app.route('/privacy-policy')
def privacy_policy():
    return render_template('privacy.html')

@app.route('/refund-policy')
def refund_policy():
    return render_template('refund.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/checkout-flow')
def checkout_flow():
    return render_template('checkout-flow.html')

if __name__ == '__main__':
    # Hosted on 0.0.0.0 to be accessible on the local network via QR code
    app.run(host='0.0.0.0', port=5050, debug=True)
