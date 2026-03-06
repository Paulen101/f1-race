"""FastF1 Cache Setup Utility"""
import os
import fastf1
from pathlib import Path


def setup_cache(cache_dir: str = None) -> Path:
    """
    Setup FastF1 cache directory for performance optimization.
    
    This function ensures that FastF1 uses a persistent cache directory,
    dramatically speeding up subsequent data requests by avoiding re-downloading
    the same data.
    
    Args:
        cache_dir: Optional custom cache directory path. 
                   Defaults to '/tmp/f1_cache' for development or 
                   './cache' for production persistence.
    
    Returns:
        Path: The cache directory path being used
    
    Example:
        >>> from app.utils.cache_setup import setup_cache
        >>> cache_path = setup_cache()
        >>> print(f"FastF1 cache enabled at: {cache_path}")
    """
    # Determine cache directory
    if cache_dir is None:
        # Check if we're in a production environment (e.g., Docker volume)
        if os.getenv('F1_CACHE_DIR'):
            cache_dir = os.getenv('F1_CACHE_DIR')
        # Use persistent cache for production
        elif os.path.exists('/app/cache'):  # Docker volume mount
            cache_dir = '/app/cache'
        # Use /tmp for local development (faster but not persistent across restarts)
        else:
            cache_dir = './cache'
    
    # Create cache directory if it doesn't exist
    cache_path = Path(cache_dir)
    cache_path.mkdir(parents=True, exist_ok=True)
    
    # Enable FastF1 cache
    fastf1.Cache.enable_cache(str(cache_path))
    
    print(f"✓ FastF1 cache enabled at: {cache_path.absolute()}")
    
    return cache_path


def clear_cache(cache_dir: str = None):
    """
    Clear the FastF1 cache directory.
    
    Useful for troubleshooting or when you need fresh data.
    
    Args:
        cache_dir: Optional cache directory path to clear
    """
    import shutil
    
    if cache_dir is None:
        cache_dir = './cache'
    
    cache_path = Path(cache_dir)
    
    if cache_path.exists():
        shutil.rmtree(cache_path)
        print(f"✓ Cache cleared: {cache_path.absolute()}")
        
        # Recreate the directory
        setup_cache(cache_dir)
    else:
        print(f"⚠ Cache directory does not exist: {cache_path.absolute()}")


def get_cache_size(cache_dir: str = None) -> dict:
    """
    Get information about cache size and contents.
    
    Args:
        cache_dir: Optional cache directory path
        
    Returns:
        dict: Cache statistics including size and file count
    """
    if cache_dir is None:
        cache_dir = './cache'
    
    cache_path = Path(cache_dir)
    
    if not cache_path.exists():
        return {
            'exists': False,
            'size_mb': 0,
            'file_count': 0
        }
    
    total_size = 0
    file_count = 0
    
    for file in cache_path.rglob('*'):
        if file.is_file():
            total_size += file.stat().st_size
            file_count += 1
    
    return {
        'exists': True,
        'size_mb': round(total_size / (1024 * 1024), 2),
        'file_count': file_count,
        'path': str(cache_path.absolute())
    }
