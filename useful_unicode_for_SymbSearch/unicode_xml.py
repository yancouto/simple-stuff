import unicodedata
import xml.etree.ElementTree as ET

def load_unicode_blocks(file_path):
    blocks = {}
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                range_part, name = line.split(';')
                start, end = [int(x, 16) for x in range_part.split('..')]
                blocks[(start, end)] = name
    return blocks

def get_block_name(blocks, codepoint):
    for (start, end), name in blocks.items():
        if start <= codepoint <= end:
            return name
    return None

def unicode_symbols_to_xml(blocks_file, output_file):
    # Load the Unicode blocks from the local file
    blocks = load_unicode_blocks(blocks_file)

    # Create the root element
    root = ET.Element("symbols", version="1")

    # Iterate over all possible Unicode code points
    for codepoint in range(0x110000):  # Unicode has 1,114,112 code points (0x110000)
        try:
            # Get the character and its name
            char = chr(codepoint)
            char_name = unicodedata.name(char)
        except ValueError:
            # Skip characters without names (e.g., unassigned code points)
            continue

        # Get the block name
        block_name = get_block_name(blocks, codepoint)

        if block_name:
            # Create an XML element for this character
            symb_element = ET.Element("symb", name=char_name, sign=char, cat=block_name)

            # Append the symb element to the root
            root.append(symb_element)
    
    print(f"Total symbols {len(root)}")

    # Create the tree and write it to a file
    tree = ET.ElementTree(root)
    tree.write(output_file, encoding="utf-8", xml_declaration=True)

if __name__ == "__main__":
    blocks_file = "Blocks.txt"  # Path to your local Blocks.txt file
    output_file = "unicode_symbols.xml"
    unicode_symbols_to_xml(blocks_file, output_file)
    print(f"Unicode symbols XML written to {output_file}")
