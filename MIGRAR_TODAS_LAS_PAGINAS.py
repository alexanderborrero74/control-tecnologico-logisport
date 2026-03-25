#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para migrar paginas de LOGISPORT al nuevo layout con sidebar.
"""

import os
import re

PAGINAS_A_MIGRAR = [
    'servicios-tecnicos.js',
    'estadisticas.js',
    'indicadores-gestion.js',
    'licencias.js',
    'control-de-contrasenas.js',
    'nube.js',
    'trazabilidad-logins.js',
    'registro-fotografico.js',
    'procesoit.js',
    'serviciospendientes.js',
    'historial-credenciales.js',
    'usuario-aplicaciones-licencias.js'
]

PAGES_DIR = 'pages'

def migrar_pagina(filename):
    """Migra una pagina al nuevo layout"""
    filepath = os.path.join(PAGES_DIR, filename)
    
    if not os.path.exists(filepath):
        print(f"[AVISO] {filename} - NO EXISTE, saltando...")
        return False
    
    print(f"\n[PROCESANDO] {filename}")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if '<LayoutWithSidebar>' in content:
            print(f"  [OK] Ya tiene LayoutWithSidebar")
            return True
        
        tiene_import_layout = 'LayoutWithSidebar' in content
        tiene_import_header = 'PageHeader' in content
        
        if not tiene_import_layout or not tiene_import_header:
            print(f"  [AGREGANDO] Imports necesarios...")
            
            lines = content.split('\n')
            last_import_idx = -1
            
            for i, line in enumerate(lines):
                if line.strip().startswith('import '):
                    last_import_idx = i
            
            if last_import_idx >= 0:
                imports_to_add = []
                if not tiene_import_layout:
                    imports_to_add.append('import LayoutWithSidebar from "@/components/LayoutWithSidebar";')
                if not tiene_import_header:
                    imports_to_add.append('import PageHeader from "@/components/PageHeader";')
                
                for imp in imports_to_add:
                    lines.insert(last_import_idx + 1, imp)
                    last_import_idx += 1
                
                content = '\n'.join(lines)
        
        component_match = re.search(r'(?:export default )?(?:function|const)\s+(\w+)', content)
        component_name = component_match.group(1) if component_match else 'Pagina'
        
        title = re.sub(r'([A-Z])', r' \1', component_name).strip()
        
        return_pattern = r'(return\s*\()\s*\n(\s*)<div'
        
        if re.search(return_pattern, content):
            print(f"  [ENVOLVIENDO] Agregando LayoutWithSidebar...")
            
            content = re.sub(
                return_pattern,
                r'\1\n\2<LayoutWithSidebar>\n\2  <PageHeader titulo="' + title + '" />\n\2  <div',
                content,
                count=1
            )
            
            lines = content.split('\n')
            
            for i in range(len(lines) - 1, -1, -1):
                line = lines[i].strip()
                if line == '</div>':
                    remaining = '\n'.join(lines[i+1:])
                    if ');' in remaining or 'export' in remaining:
                        indent = len(lines[i]) - len(lines[i].lstrip())
                        lines[i] = ' ' * indent + '</div>\n' + ' ' * max(0, indent - 2) + '</LayoutWithSidebar>'
                        break
            
            content = '\n'.join(lines)
            
            content = re.sub(
                r'<button[^>]*onClick=\{\(\) => router\.push\(["\'/]["\']?\)\}[^>]*>\s*.*?Regresar.*?</button>',
                '',
                content,
                flags=re.DOTALL
            )
            
            content = re.sub(
                r'backBtn:\s*\{[^}]*position:\s*["\']fixed["\'][^}]*\},?',
                '',
                content,
                flags=re.DOTALL
            )
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"  [EXITO] {filename} migrado correctamente")
            return True
        else:
            print(f"  [AVISO] Patron de return no encontrado, requiere revision manual")
            return False
            
    except Exception as e:
        print(f"  [ERROR] {str(e)}")
        return False

def main():
    print("=" * 80)
    print("MIGRACION MASIVA DE PAGINAS A LAYOUT CON SIDEBAR")
    print("=" * 80)
    print(f"\nDirectorio: {os.path.abspath(PAGES_DIR)}")
    print(f"Paginas a migrar: {len(PAGINAS_A_MIGRAR)}\n")
    
    exitosas = 0
    fallidas = 0
    
    for pagina in PAGINAS_A_MIGRAR:
        if migrar_pagina(pagina):
            exitosas += 1
        else:
            fallidas += 1
    
    print("\n" + "=" * 80)
    print("RESUMEN DE MIGRACION")
    print("=" * 80)
    print(f"  Exitosas: {exitosas}")
    print(f"  Fallidas: {fallidas}")
    print(f"  Total: {len(PAGINAS_A_MIGRAR)}")
    
    if fallidas > 0:
        print("\n[AVISO] Algunas paginas requieren migracion manual.")
    else:
        print("\n[EXITO] TODAS LAS PAGINAS MIGRADAS EXITOSAMENTE!")
        print("\nSIGUIENTE PASO:")
        print("  1. Revisar cambios: git diff")
        print("  2. Probar localmente: npm run dev")
        print("  3. Desplegar: vercel --prod")

if __name__ == '__main__':
    main()
