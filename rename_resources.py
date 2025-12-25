import os

def normalize_images():
    folder = 'resources'
    if not os.path.exists(folder):
        print(f"Folder '{folder}' does not exist. Please create it and add images.")
        return

    # Get all files
    files = os.listdir(folder)
    # Filter images
    valid_exts = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}
    images = [f for f in files if os.path.splitext(f.lower())[1] in valid_exts]
    
    # Sort to ensure deterministic order (optional)
    images.sort()
    
    print(f"Found {len(images)} images. Renaming...")
    
    # Rename with temporary prefix to avoid collisions (e.g. 1.jpg -> 2.jpg processing)
    # Step 1: Sequential to temp
    temp_names = []
    for i, filename in enumerate(images):
        old_path = os.path.join(folder, filename)
        # Force .jpg extension as requested to simplify HTML logic
        new_name = f"__temp_{i+1}.jpg"
        new_path = os.path.join(folder, new_name)
        os.rename(old_path, new_path)
        temp_names.append(new_name)
        
    # Step 2: Temp to final
    for i, filename in enumerate(temp_names):
        old_path = os.path.join(folder, filename)
        final_name = f"{i+1}.jpg"
        final_path = os.path.join(folder, final_name)
        os.rename(old_path, final_path)
        print(f"Renamed: {images[i]} -> {final_name}")

    print("Done! You can now refresh the web page.")

if __name__ == '__main__':
    normalize_images()
