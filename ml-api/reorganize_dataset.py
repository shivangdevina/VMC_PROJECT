#!/usr/bin/env python3
"""
Script to reorganize the dataset from class-based folders to YOLO format
"""

import os
import shutil
from pathlib import Path
import random

def create_yolo_structure():
    """Create the proper YOLO directory structure"""
    base_path = Path("datasets")
    
    # Create directories
    (base_path / "train" / "images").mkdir(parents=True, exist_ok=True)
    (base_path / "train" / "labels").mkdir(parents=True, exist_ok=True)
    (base_path / "val" / "images").mkdir(parents=True, exist_ok=True)
    (base_path / "val" / "labels").mkdir(parents=True, exist_ok=True)
    
    return base_path

def map_class_to_id(class_name):
    """Map class names to YOLO class IDs"""
    class_mapping = {
        'cracks': 0,
        'good_road': 1,
        'open_manhole': 2,
        'pothole': 3
    }
    return class_mapping.get(class_name, -1)

def convert_label_file(label_path, class_id, output_path):
    """Convert existing label file to YOLO format with correct class ID"""
    try:
        with open(label_path, 'r') as f:
            lines = f.readlines()
        
        with open(output_path, 'w') as f:
            for line in lines:
                parts = line.strip().split()
                if len(parts) >= 5:
                    # Replace the first element (class ID) with our mapping
                    parts[0] = str(class_id)
                    f.write(' '.join(parts) + '\n')
                elif len(parts) == 1:
                    # If label only contains class ID, use our mapping
                    f.write(f"{class_id}\n")
    except Exception as e:
        print(f"Error converting label file {label_path}: {e}")
        # Create a simple label file with just the class
        with open(output_path, 'w') as f:
            f.write(f"{class_id} 0.5 0.5 0.8 0.8\n")  # Default bounding box

def reorganize_dataset():
    """Reorganize the dataset from class folders to YOLO format"""
    
    # Source path
    source_path = Path("datasets/dataset/dataset/classes")
    
    if not source_path.exists():
        print(f"Source path {source_path} does not exist!")
        return
    
    # Create YOLO structure
    base_path = create_yolo_structure()
    
    # Get all class folders
    class_folders = [f for f in source_path.iterdir() if f.is_dir() and f.name != "desktop.ini"]
    
    print(f"Found classes: {[f.name for f in class_folders]}")
    
    all_files = []
    
    # Collect all image-label pairs
    for class_folder in class_folders:
        class_name = class_folder.name
        class_id = map_class_to_id(class_name)
        
        if class_id == -1:
            print(f"Unknown class: {class_name}, skipping...")
            continue
            
        print(f"Processing class: {class_name} (ID: {class_id})")
        
        # Look for images folder
        images_folder = class_folder / "images"
        labels_folder = class_folder / "labels" / "txt"  # Use txt labels
        
        if not images_folder.exists():
            print(f"Images folder not found for {class_name}")
            continue
            
        # Get all image files
        image_files = list(images_folder.glob("*.jpg")) + list(images_folder.glob("*.jpeg")) + list(images_folder.glob("*.png"))
        image_files = [f for f in image_files if not f.name.startswith("desktop")]
        
        print(f"Found {len(image_files)} images for {class_name}")
        
        for image_file in image_files:
            # Find corresponding label file
            label_name = image_file.stem + ".txt"
            label_file = labels_folder / label_name
            
            if label_file.exists():
                all_files.append((image_file, label_file, class_id))
            else:
                print(f"Label not found for {image_file.name}, creating default label")
                all_files.append((image_file, None, class_id))
    
    print(f"Total files to process: {len(all_files)}")
    
    # Shuffle and split
    random.shuffle(all_files)
    split_idx = int(0.8 * len(all_files))  # 80% train, 20% val
    
    train_files = all_files[:split_idx]
    val_files = all_files[split_idx:]
    
    print(f"Train files: {len(train_files)}, Val files: {len(val_files)}")
    
    # Copy files to train folder
    for i, (image_file, label_file, class_id) in enumerate(train_files):
        # Copy image
        new_image_name = f"train_{i:06d}.jpg"
        shutil.copy2(image_file, base_path / "train" / "images" / new_image_name)
        
        # Copy/create label
        label_name = f"train_{i:06d}.txt"
        label_output = base_path / "train" / "labels" / label_name
        
        if label_file and label_file.exists():
            convert_label_file(label_file, class_id, label_output)
        else:
            # Create default label
            with open(label_output, 'w') as f:
                f.write(f"{class_id} 0.5 0.5 0.8 0.8\n")
    
    # Copy files to val folder
    for i, (image_file, label_file, class_id) in enumerate(val_files):
        # Copy image
        new_image_name = f"val_{i:06d}.jpg"
        shutil.copy2(image_file, base_path / "val" / "images" / new_image_name)
        
        # Copy/create label
        label_name = f"val_{i:06d}.txt"
        label_output = base_path / "val" / "labels" / label_name
        
        if label_file and label_file.exists():
            convert_label_file(label_file, class_id, label_output)
        else:
            # Create default label
            with open(label_output, 'w') as f:
                f.write(f"{class_id} 0.5 0.5 0.8 0.8\n")
    
    print("Dataset reorganization complete!")
    print(f"Train: {len(train_files)} files")
    print(f"Val: {len(val_files)} files")

if __name__ == "__main__":
    reorganize_dataset()
