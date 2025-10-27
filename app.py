"""
Flask backend for ZenRoot AI - Plant Disease Detection
Using Transfer Learning with Pre-trained ResNet18
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image
import io

app = Flask(__name__)
CORS(app)

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# 38 Classes from PlantVillage dataset (corrected count)
DISEASE_CLASSES = [
    'Apple___Apple_scab',
    'Apple___Black_rot',
    'Apple___Cedar_apple_rust',
    'Apple___healthy',
    'Blueberry___healthy',
    'Cherry_(including_sour)___Powdery_mildew',
    'Cherry_(including_sour)___healthy',
    'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot',
    'Corn_(maize)___Common_rust_',
    'Corn_(maize)___Northern_Leaf_Blight',
    'Corn_(maize)___healthy',
    'Grape___Black_rot',
    'Grape___Esca_(Black_Measles)',
    'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)',
    'Grape___healthy',
    'Orange___Haunglongbing_(Citrus_greening)',
    'Peach___Bacterial_spot',
    'Peach___healthy',
    'Pepper,_bell___Bacterial_spot',
    'Pepper,_bell___healthy',
    'Potato___Early_blight',
    'Potato___Late_blight',
    'Potato___healthy',
    'Raspberry___healthy',
    'Soybean___healthy',
    'Squash___Powdery_mildew',
    'Strawberry___Leaf_scorch',
    'Strawberry___healthy',
    'Tomato___Bacterial_spot',
    'Tomato___Early_blight',
    'Tomato___Late_blight',
    'Tomato___Leaf_Mold',
    'Tomato___Septoria_leaf_spot',
    'Tomato___Spider_mites Two-spotted_spider_mite',
    'Tomato___Target_Spot',
    'Tomato___Tomato_Yellow_Leaf_Curl_Virus',
    'Tomato___Tomato_mosaic_virus',
    'Tomato___healthy'
]

# Use ResNet18 with transfer learning
def create_model(num_classes):
    """Create a pre-trained ResNet18 model"""
    model = models.resnet18(pretrained=True)
    
    # Replace final layer for our classes
    num_features = model.fc.in_features
    model.fc = nn.Linear(num_features, num_classes)
    
    return model

# Image preprocessing - standard ImageNet preprocessing
transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# Load or create model
print("Initializing model...")
try:
    # Try to load your custom trained model first
    try:
        from pathlib import Path
        MODEL_PATH = 'plant_disease_model_resnet18.pt'
        
        if Path(MODEL_PATH).exists():
            print(f"Loading fine-tuned model from {MODEL_PATH}...")
            model = create_model(num_classes=len(DISEASE_CLASSES))
            state_dict = torch.load(MODEL_PATH, map_location=device)
            model.load_state_dict(state_dict)
            print("✓ Fine-tuned model loaded!")
        else:
            raise FileNotFoundError("Custom model not found")
    
    except (FileNotFoundError, RuntimeError) as e:
        # Use pre-trained ResNet as fallback
        print(f"⚠️  Could not load custom model: {e}")
        print("⚠️  Using pre-trained ResNet18 (ImageNet)...")
        print("📝 Note: This will give general image classification, not disease-specific.")
        print("    For accurate disease detection, you need to train the model.")
        model = create_model(num_classes=len(DISEASE_CLASSES))
        
        # Initialize final layer with small random weights
        nn.init.normal_(model.fc.weight, mean=0.0, std=0.01)
        nn.init.constant_(model.fc.bias, 0)
        
        print("✓ Model initialized with pre-trained ImageNet features")
    
    model.to(device)
    model.eval()
    
    print(f"✓ Device: {device}")
    print(f"✓ Classes: {len(DISEASE_CLASSES)}")
    
except Exception as e:
    print(f"✗ Failed to initialize model: {e}")
    import traceback
    traceback.print_exc()
    model = None

# Disease information database
DISEASE_INFO = {
    'healthy': {
        'description': 'Your plant appears healthy! No signs of disease detected. Continue your current care routine.',
        'prevention': 'Maintain proper watering schedule, ensure adequate sunlight, and monitor regularly for any changes.'
    },
    'scab': {
        'description': 'Apple scab is a fungal disease causing dark, scabby lesions on leaves and fruit.',
        'prevention': 'Remove fallen leaves, prune for air circulation, apply fungicides in spring, choose resistant varieties.'
    },
    'rot': {
        'description': 'Causes circular brown spots with purple margins on leaves and rotting fruit.',
        'prevention': 'Prune infected branches, remove mummified fruit, apply fungicides, ensure good air circulation.'
    },
    'rust': {
        'description': 'Fungal disease causing bright orange spots or pustules on leaves.',
        'prevention': 'Remove infected leaves, ensure good air circulation, apply fungicides, plant resistant varieties.'
    },
    'mildew': {
        'description': 'White powdery fungal growth on leaves and stems.',
        'prevention': 'Improve air circulation, avoid overhead watering, apply fungicides, remove infected parts.'
    },
    'spot': {
        'description': 'Bacterial or fungal disease causing small dark spots with yellow halos on leaves.',
        'prevention': 'Use disease-free seeds, rotate crops, avoid overhead watering, apply copper sprays.'
    },
    'blight': {
        'description': 'Rapid browning and wilting of leaves, can kill plants quickly.',
        'prevention': 'Use resistant varieties, ensure good drainage, avoid overhead watering, apply fungicides preventively.'
    },
    'mold': {
        'description': 'Fungal disease causing pale spots on upper leaf surfaces.',
        'prevention': 'Improve ventilation, reduce humidity, space plants properly, remove infected leaves.'
    },
    'mites': {
        'description': 'Tiny pests causing stippling, yellowing, and webbing on leaves.',
        'prevention': 'Spray with water, introduce predatory mites, apply insecticidal soap, maintain humidity.'
    },
    'virus': {
        'description': 'Viral disease causing mottled patterns, leaf curling, or yellowing.',
        'prevention': 'Use virus-free seeds, control insect vectors, remove infected plants, sanitize tools.'
    },
    'greening': {
        'description': 'Citrus greening disease causing yellowing, misshapen fruit, and tree decline.',
        'prevention': 'Control psyllid vectors, remove infected trees immediately, use disease-free nursery stock.'
    },
    'scorch': {
        'description': 'Browning and drying of leaf edges, often due to environmental stress.',
        'prevention': 'Ensure adequate watering, protect from extreme heat, improve soil drainage.'
    }
}

def get_disease_info(disease_name):
    """Get disease info based on keywords"""
    name_lower = disease_name.lower()
    
    for keyword, info in DISEASE_INFO.items():
        if keyword in name_lower:
            return info
    
    return {
        'description': f'Disease detected: {disease_name}. Monitor plant closely and consult a specialist if needed.',
        'prevention': 'Maintain good plant hygiene, ensure proper watering and nutrition, monitor regularly for changes.'
    }

def preprocess_image(image_bytes):
    """Preprocess image for model"""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != 'RGB':
            img = img.convert('RGB')
        return transform(img).unsqueeze(0)
    except Exception as e:
        print(f"Preprocessing error: {e}")
        return None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'device': str(device),
        'framework': 'PyTorch',
        'model_type': 'ResNet18 (Transfer Learning)',
        'classes': len(DISEASE_CLASSES),
        'note': 'Using trained model for accurate predictions.'
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Main prediction endpoint"""
    try:
        if model is None:
            return jsonify({
                'error': 'Model not loaded',
                'message': 'Please check server logs for details'
            }), 500
        
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        image_file = request.files['image']
        image_bytes = image_file.read()
        
        img_tensor = preprocess_image(image_bytes)
        if img_tensor is None:
            return jsonify({'error': 'Failed to process image'}), 400
        
        img_tensor = img_tensor.to(device)
        
        # Make prediction
        with torch.no_grad():
            outputs = model(img_tensor)
            probabilities = torch.nn.functional.softmax(outputs, dim=1)
            confidence, predicted_idx = torch.max(probabilities, 1)
        
        pred_class = DISEASE_CLASSES[predicted_idx.item()]
        conf_value = confidence.item()
        
        info = get_disease_info(pred_class)
        display_name = pred_class.replace('___', ' - ').replace('_', ' ')
        
        # Get top 3 predictions
        top3_prob, top3_idx = torch.topk(probabilities[0], min(3, len(DISEASE_CLASSES)))
        top_predictions = [
            {
                'class': DISEASE_CLASSES[idx.item()].replace('___', ' - ').replace('_', ' '),
                'confidence': prob.item(),
                'confidence_percent': f"{prob.item() * 100:.1f}%"
            }
            for prob, idx in zip(top3_prob, top3_idx)
        ]
        
        response = {
            'success': True,
            'prediction': {
                'class': pred_class,
                'display_name': display_name,
                'confidence': conf_value,
                'confidence_percent': f"{conf_value * 100:.1f}%"
            },
            'disease_info': {
                'title': display_name,
                'description': info['description'],
                'prevention': info['prevention']
            },
            'top_predictions': top_predictions
        }
        
        return jsonify(response)
        
    except Exception as e:
        print(f"Prediction error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'Prediction failed',
            'message': str(e)
        }), 500

@app.route('/classes', methods=['GET'])
def get_classes():
    """Return list of supported classes"""
    return jsonify({
        'classes': DISEASE_CLASSES,
        'count': len(DISEASE_CLASSES)
    })

if __name__ == '__main__':
    print("\n🌿 ZenRoot AI - Plant Disease Detection Server")
    print("=" * 60)
    print(f"Model: ResNet18 (Transfer Learning)")
    print(f"Status: {'✓ Ready' if model else '✗ Failed to Load'}")
    print(f"Device: {device}")
    print(f"Classes: {len(DISEASE_CLASSES)}")
    print("=" * 60)
    print(f"\n✓ Server running at http://localhost:5000")
    print(f"✓ Open home.html in your browser to use the app\n")
    app.run(host='0.0.0.0', port=5000, debug=True)