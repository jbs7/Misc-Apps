import re

libapp_path = 'config.arm64_v8a.apk/lib/arm64-v8a/libapp.so'

try:
    with open(libapp_path, 'rb') as f:
        data = f.read()
except FileNotFoundError:
    print(f"Error: {libapp_path} not found.")
    import sys
    sys.exit(1)

# Find all printable ASCII strings
ascii_re = re.compile(b'[ -~]{3,}')
all_strings = []
for match in ascii_re.finditer(data):
    all_strings.append(match.group().decode('ascii', errors='ignore'))

keywords = ['.db', '.sqlite', '.zip', 'storage', 'googleapis', 'bucket', 'download']

print("Searching for file extensions and storage references:")
found = False
for s in sorted(list(set(all_strings))):
    s_lower = s.lower()
    for kw in keywords:
        if kw in s_lower:
            print(f"  [{kw}] -> {s}")
            found = True
            break

if not found:
    print("No references found.")
