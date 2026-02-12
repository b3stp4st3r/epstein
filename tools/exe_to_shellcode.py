#!/usr/bin/env python3
"""
EXE to Shellcode Converter
Converts .exe file to C++ shellcode array
"""

import sys
import os

def exe_to_shellcode(exe_path, output_path=None):
    """Convert EXE to shellcode"""
    
    if not os.path.exists(exe_path):
        print(f"Error: File {exe_path} not found")
        return False
    
    # Read EXE file
    with open(exe_path, 'rb') as f:
        exe_data = f.read()
    
    # Generate shellcode
    shellcode = 'unsigned char rootkit_shellcode[] = {\n    '
    
    for i, byte in enumerate(exe_data):
        if i > 0 and i % 16 == 0:
            shellcode += '\n    '
        shellcode += f'0x{byte:02x}'
        if i < len(exe_data) - 1:
            shellcode += ', '
    
    shellcode += '\n};\n'
    shellcode += f'unsigned int rootkit_shellcode_len = {len(exe_data)};\n'
    
    # Output
    if output_path:
        with open(output_path, 'w') as f:
            f.write(shellcode)
        print(f"Shellcode saved to: {output_path}")
    else:
        print(shellcode)
    
    print(f"\nStats:")
    print(f"  Original size: {len(exe_data)} bytes")
    print(f"  Shellcode size: {len(shellcode)} bytes")
    
    return True

def main():
    if len(sys.argv) < 2:
        print("Usage: python exe_to_shellcode.py <input.exe> [output.txt]")
        print("\nExample:")
        print("  python exe_to_shellcode.py payload.exe shellcode.txt")
        sys.exit(1)
    
    exe_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    exe_to_shellcode(exe_path, output_path)

if __name__ == '__main__':
    main()
