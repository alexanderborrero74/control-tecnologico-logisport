"""
Script Python para extraer trabajadores del Excel y generar JSON para importar a Firebase.
Uso: python3 scripts/extraer-trabajadores.py
Requiere: pip install openpyxl
"""

import zipfile
import xml.etree.ElementTree as ET
import json
import os
import sys

XLSX_PATH = os.path.join(os.path.dirname(__file__), '..', '03_NOMINA_01_AL_15__DE_FEBRERO_SPIA_2026.xlsx')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'trabajadores-data.json')

def get_shared_strings(z):
    with z.open('xl/sharedStrings.xml') as f:
        tree = ET.parse(f)
        root = tree.getroot()
        ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        strings = []
        for si in root.findall('ns:si', ns):
            t_elements = si.findall('.//ns:t', ns)
            text = ''.join(t.text or '' for t in t_elements)
            strings.append(text)
        return strings

def read_sheet(z, sheet_file, shared_strings):
    with z.open(sheet_file) as f:
        tree = ET.parse(f)
        root = tree.getroot()
        ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        rows_data = []
        for row in root.findall('.//ns:row', ns):
            row_num = int(row.get('r', 0))
            cells = {}
            for cell in row.findall('ns:c', ns):
                ref = cell.get('r')
                col = ''.join(filter(str.isalpha, ref))
                t = cell.get('t', '')
                v_el = cell.find('ns:v', ns)
                val = None
                if v_el is not None and v_el.text is not None:
                    if t == 's':
                        idx = int(v_el.text)
                        val = shared_strings[idx] if idx < len(shared_strings) else ''
                    else:
                        val = v_el.text
                cells[col] = val
            if cells:
                rows_data.append((row_num, cells))
        return rows_data

if not os.path.exists(XLSX_PATH):
    # Buscar el xlsx en el directorio actual o padre
    for candidate in [
        'scripts/03_NOMINA_01_AL_15__DE_FEBRERO_SPIA_2026.xlsx',
        '03_NOMINA_01_AL_15__DE_FEBRERO_SPIA_2026.xlsx',
    ]:
        if os.path.exists(candidate):
            XLSX_PATH = candidate
            break
    else:
        print(f"ERROR: No se encontró el archivo Excel.")
        print(f"Coloca el archivo en la raíz del proyecto o en scripts/")
        sys.exit(1)

print(f"Leyendo: {XLSX_PATH}")

with zipfile.ZipFile(XLSX_PATH) as z:
    shared = get_shared_strings(z)
    rows = read_sheet(z, 'xl/worksheets/sheet5.xml', shared)

trabajadores = {}
for row_num, cells in rows:
    nombre = cells.get('A', '')
    cedula = cells.get('B', '')
    cargo = cells.get('C', '')
    cuadrilla = cells.get('D', '')
    
    if not nombre or not cedula or row_num == 1:
        continue
    
    cedula_str = str(cedula).split('.')[0].strip()
    if not cedula_str.isdigit():
        continue
    
    # Deduplicar por cédula
    if cedula_str not in trabajadores:
        trabajadores[cedula_str] = {
            'nombre': str(nombre).strip(),
            'cedula': cedula_str,
            'cargo': str(cargo).strip() if cargo else 'ESTIBADOR',
            'cuadrilla': str(cuadrilla).strip() if cuadrilla else '',
        }

result = list(trabajadores.values())
result.sort(key=lambda x: x['nombre'])

with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"✅ {len(result)} trabajadores únicos exportados a: {OUTPUT_PATH}")
print("\nPrimeros 5:")
for t in result[:5]:
    print(f"  {t['cedula']} - {t['nombre']} ({t['cargo']})")
