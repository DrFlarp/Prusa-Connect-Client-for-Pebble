import zlib
import struct
import os

def create_png(width, height, pixel_data, output_path):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter byte None
        for x in range(width):
            raw += bytes(pixel_data[y][x])

    png = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # RGBA 8-bit
    png += chunk(b'IHDR', ihdr)
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(png)
    print(f"Created PNG at {output_path} ({len(png)} bytes)")

# 25x25 ASCII layout
# '.' = transparent (0, 0, 0, 0)
# '#' = solid white (255, 255, 255, 255)
# 'o' = Prusa orange / accent (255, 102, 0, 255)
# '+' = subtle gray / highlight (180, 180, 180, 255)

LAYOUT = [
    ".........................", # 0
    "...........###...........", # 1  Spool top
    "..........#...#..........", # 2  Spool rim
    "..........#.+.#..........", # 3  Spool hub
    "...........###...........", # 4  Spool bottom
    "............#............", # 5  Filament lead
    "...###################...", # 6  Gantry top
    "...###################...", # 7
    "...##.......+.......##...", # 8  Frame & rods
    "...##...............##...", # 9
    "...##....#######....##...", # 10 Extruder carriage
    "...##...#########...##...", # 11 Extruder body
    "...##....#######....##...", # 12 Extruder base
    "...##.....#####.....##...", # 13 Heat block
    "...##......###......##...", # 14 Nozzle
    "...##.......#.......##...", # 15 Extrusion tip
    "...##.....ooooo.....##...", # 16 Printed model (Prusa orange)
    "...##....ooooooo....##...", # 17 Printed model base
    ".#######################.", # 18 Heatbed
    ".#######################.", # 19 Heatbed
    "...##...............##...", # 20 Clearance
    ".#######################.", # 21 Chassis base
    ".#######################.", # 22 Chassis base
    "...###.............###...", # 23 Rubber feet
    ".........................", # 24
]

for idx, r in enumerate(LAYOUT):
    if len(r) != 25:
        raise ValueError(f"Row {idx} length is {len(r)}: '{r}'")

COLOR_MAP = {
    '.': (0, 0, 0, 0),
    '#': (255, 255, 255, 255),
    '+': (200, 200, 200, 255),
    'o': (255, 102, 0, 255)
}

height = len(LAYOUT)
width = len(LAYOUT[0])
assert width == 25 and height == 25, f"Dimensions must be 25x25, got {width}x{height}"

pixels = []
for row in LAYOUT:
    pixel_row = []
    for ch in row:
        pixel_row.append(COLOR_MAP.get(ch, (0, 0, 0, 0)))
    pixels.append(pixel_row)

create_png(25, 25, pixels, "resources/images/menu_icon.png")
