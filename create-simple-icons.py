#!/usr/bin/env python3
"""
Simple script to create placeholder icons for Teams app
"""
import os

# Create a simple SVG to PNG conversion using base64 encoded images
def create_color_icon():
    # Simple blue square with microphone emoji as placeholder
    svg_content = '''<svg width="192" height="192" xmlns="http://www.w3.org/2000/svg">
  <rect width="192" height="192" fill="#0078d4"/>
  <text x="96" y="120" font-family="Arial" font-size="80" text-anchor="middle" fill="white">🎤</text>
  <text x="96" y="160" font-family="Arial" font-size="20" text-anchor="middle" fill="white">MT</text>
</svg>'''
    
    with open('assets/icon-color.svg', 'w') as f:
        f.write(svg_content)
    print("Created assets/icon-color.svg")

def create_outline_icon():
    # Simple white microphone on transparent background
    svg_content = '''<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
  <text x="16" y="20" font-family="Arial" font-size="20" text-anchor="middle" fill="white">🎤</text>
</svg>'''
    
    with open('assets/icon-outline.svg', 'w') as f:
        f.write(svg_content)
    print("Created assets/icon-outline.svg")

if __name__ == "__main__":
    os.makedirs('assets', exist_ok=True)
    create_color_icon()
    create_outline_icon()
    print("Icons created! You can convert these SVGs to PNG using online tools or design software.")