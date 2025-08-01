#!/usr/bin/env python3
"""
Civic Hazard Detection ML API
FastAPI server with YOLOv8 model for detecting road hazards
"""

import os
import time
import io
import logging
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import torch
from ultralytics import YOLO
from PIL import Image
import numpy as np
import cv2

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global model variable
model = None

class PredictionResponse(BaseModel):
    predictions: List[Dict[str, Any]]
    processing_time: float
    model_version: str
    image_size: Optional[tuple] = None

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str
    timestamp: str

class ModelInfo(BaseModel):
    model_name: str
    model_version: str
    device: str
    classes: List[str]
    input_size: tuple

# Security
security = HTTPBearer(auto_error=False)

async def verify_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify API key if provided in environment"""
    api_key = os.getenv('ML_API_KEY')
    
    if api_key:  # Only check if API key is set
        if not credentials or credentials.credentials != api_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key"
            )
    return credentials

def load_model():
    """Load YOLOv8 model"""
    global model
    
    try:
        # Check if custom model exists, otherwise use pre-trained
        custom_model_path = os.getenv('MODEL_PATH', 'models/hazard_detection.pt')
        
        if os.path.exists(custom_model_path):
            logger.info(f"Loading custom model from {custom_model_path}")
            model = YOLO(custom_model_path)
        else:
            logger.info("Loading pre-trained YOLOv8 model")
            model = YOLO('yolov8n.pt')  # Start with nano for speed
        
        # Set device
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        model.to(device)
        
        logger.info(f"Model loaded successfully on {device}")
        logger.info(f"Model classes: {list(model.names.values())}")
        
        return True
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        return False

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("Starting ML API server...")
    
    # Create models directory if it doesn't exist
    os.makedirs('models', exist_ok=True)
    
    # Load the model
    if not load_model():
        logger.error("Failed to load model during startup")
        raise RuntimeError("Model loading failed")
    
    logger.info("ML API server started successfully")
    yield
    
    # Shutdown
    logger.info("Shutting down ML API server...")

# Create FastAPI app
app = FastAPI(
    title="Civic Hazard Detection API",
    description="YOLOv8-based API for detecting road hazards in images and videos",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on your needs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def map_yolo_to_hazard_classes(yolo_predictions, confidence_threshold=0.5):
    """Map YOLO detection classes to our hazard types"""
    
    # Mapping from our custom model classes to hazard types
    class_mapping = {
        # Custom hazard detection classes
        'cracks': 'road_cracks',
        'good_road': 'good_road',
        'open_manhole': 'open_manhole',
        'pothole': 'pothole',
        
        # Fallback COCO classes (in case pre-trained model is used)
        'person': 'other',
        'bicycle': 'other',
        'car': 'other',
        'motorcycle': 'other',
        'bus': 'other',
        'truck': 'other',
        'traffic light': 'traffic_light_issue',
        'stop sign': 'signage_damage',
        'bench': 'debris',
        'bird': 'other',
        'cat': 'cattle_on_road',
        'dog': 'cattle_on_road',
        'horse': 'cattle_on_road',
        'sheep': 'cattle_on_road',
        'cow': 'cattle_on_road',
        'elephant': 'cattle_on_road',
        'bear': 'cattle_on_road',
        'zebra': 'cattle_on_road',
        'giraffe': 'cattle_on_road',
        'umbrella': 'debris',
        'handbag': 'debris',
        'tie': 'debris',
        'suitcase': 'debris',
        'frisbee': 'debris',
        'skis': 'debris',
        'snowboard': 'debris',
        'sports ball': 'debris',
        'kite': 'debris',
        'baseball bat': 'debris',
        'baseball glove': 'debris',
        'skateboard': 'debris',
        'surfboard': 'debris',
        'tennis racket': 'debris',
        'bottle': 'debris',
        'wine glass': 'debris',
        'cup': 'debris',
        'fork': 'debris',
        'knife': 'debris',
        'spoon': 'debris',
        'bowl': 'debris',
        'chair': 'debris',
        'couch': 'debris',
        'potted plant': 'debris',
        'bed': 'debris',
        'dining table': 'debris',
        'toilet': 'debris',
        'tv': 'debris',
        'laptop': 'debris',
        'mouse': 'debris',
        'remote': 'debris',
        'keyboard': 'debris',
        'cell phone': 'debris',
        'microwave': 'debris',
        'oven': 'debris',
        'toaster': 'debris',
        'sink': 'debris',
        'refrigerator': 'debris',
        'book': 'debris',
        'clock': 'debris',
        'vase': 'debris',
        'scissors': 'debris',
        'teddy bear': 'debris',
        'hair drier': 'debris',
        'toothbrush': 'debris'
    }
    
    mapped_predictions = []
    
    for pred in yolo_predictions:
        if pred['confidence'] >= confidence_threshold:
            class_name = pred['class'].lower()
            hazard_type = class_mapping.get(class_name, 'other')
            
            mapped_predictions.append({
                'class': hazard_type,
                'confidence': pred['confidence'],
                'bbox': pred['bbox'],
                'original_class': pred['class']
            })
    
    return mapped_predictions

def process_yolo_results(results, img_shape):
    """Process YOLO results into our format"""
    predictions = []
    
    for result in results:
        if result.boxes is not None:
            boxes = result.boxes
            
            for i in range(len(boxes)):
                # Get bounding box coordinates
                box = boxes.xyxy[i].cpu().numpy()
                confidence = float(boxes.conf[i].cpu().numpy())
                class_id = int(boxes.cls[i].cpu().numpy())
                class_name = model.names[class_id]
                
                predictions.append({
                    'class': class_name,
                    'confidence': confidence,
                    'bbox': [float(x) for x in box]  # [x1, y1, x2, y2]
                })
    
    return predictions

def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Preprocess image for YOLO inference"""
    try:
        # Convert bytes to PIL Image
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert to numpy array
        img_array = np.array(image)
        
        return img_array
    except Exception as e:
        logger.error(f"Image preprocessing error: {e}")
        raise HTTPException(status_code=400, detail="Invalid image format")

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    
    return HealthResponse(
        status="healthy" if model is not None else "unhealthy",
        model_loaded=model is not None,
        device=device,
        timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    )

@app.get("/info", response_model=ModelInfo)
async def get_model_info(credentials: HTTPAuthorizationCredentials = Depends(verify_api_key)):
    """Get model information"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    
    return ModelInfo(
        model_name="YOLOv8",
        model_version="8.0.196",
        device=device,
        classes=list(model.names.values()),
        input_size=(640, 640)
    )

@app.post("/predict", response_model=PredictionResponse)
async def predict_hazard(
    file: UploadFile = File(...),
    confidence_threshold: float = 0.5,
    credentials: HTTPAuthorizationCredentials = Depends(verify_api_key)
):
    """Predict hazards in a single image"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        start_time = time.time()
        
        # Read and preprocess image
        image_bytes = await file.read()
        img_array = preprocess_image(image_bytes)
        
        # Run inference
        results = model(img_array, conf=confidence_threshold, verbose=False)
        
        # Process results
        yolo_predictions = process_yolo_results(results, img_array.shape)
        
        # Map to hazard classes
        hazard_predictions = map_yolo_to_hazard_classes(yolo_predictions, confidence_threshold)
        
        processing_time = time.time() - start_time
        
        return PredictionResponse(
            predictions=hazard_predictions,
            processing_time=round(processing_time, 3),
            model_version="YOLOv8",
            image_size=img_array.shape[:2]
        )
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.post("/predict/batch")
async def predict_batch(
    files: List[UploadFile] = File(...),
    confidence_threshold: float = 0.5,
    credentials: HTTPAuthorizationCredentials = Depends(verify_api_key)
):
    """Predict hazards in multiple images"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    if len(files) > 10:  # Limit batch size
        raise HTTPException(status_code=400, detail="Maximum 10 images per batch")
    
    results = []
    
    for i, file in enumerate(files):
        if not file.content_type.startswith('image/'):
            continue
        
        try:
            start_time = time.time()
            
            # Read and preprocess image
            image_bytes = await file.read()
            img_array = preprocess_image(image_bytes)
            
            # Run inference
            model_results = model(img_array, conf=confidence_threshold, verbose=False)
            
            # Process results
            yolo_predictions = process_yolo_results(model_results, img_array.shape)
            
            # Map to hazard classes
            hazard_predictions = map_yolo_to_hazard_classes(yolo_predictions, confidence_threshold)
            
            processing_time = time.time() - start_time
            
            results.append({
                "file_index": i,
                "filename": file.filename,
                "predictions": hazard_predictions,
                "processing_time": round(processing_time, 3),
                "image_size": img_array.shape[:2]
            })
            
        except Exception as e:
            logger.error(f"Batch prediction error for file {i}: {e}")
            results.append({
                "file_index": i,
                "filename": file.filename,
                "error": str(e)
            })
    
    return {"results": results}

@app.post("/predict/video")
async def predict_video(
    file: UploadFile = File(...),
    confidence_threshold: float = 0.5,
    frame_interval: int = 30,  # Process every Nth frame
    credentials: HTTPAuthorizationCredentials = Depends(verify_api_key)
):
    """Predict hazards in video (basic implementation)"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    if not file.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail="File must be a video")
    
    # Note: This is a basic implementation
    # For production, you might want to use more sophisticated video processing
    raise HTTPException(status_code=501, detail="Video processing not fully implemented")

if __name__ == "__main__":
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    port = int(os.getenv('PORT', 8000))
    host = os.getenv('HOST', '0.0.0.0')
    
    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )
