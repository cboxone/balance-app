#!/usr/bin/env python3
"""Vérifie que chaque `import { a, b } from './x.js'` entre fichiers du
projet correspond bien à des noms réellement exportés par le fichier cible.
Signale séparément les imports qui pointent vers un module pas encore créé
(migration en cours) — ce n'est pas une erreur en soi tant que le module
correspondant n'a pas été migré (voir MIGRATION.md)."""
import re, os, sys

ROOT = os.path.join(os.path.dirname(__file__), '..')

def exports_of(path):
    if not os.path.exists(path):
        return None
    src = open(path).read()
    names = set()
    for m in re.finditer(r'export\s+(?:async\s+)?function\s+(\w+)', src):
        names.add(m.group(1))
    for m in re.finditer(r'export\s+const\s+(\w+)', src):
        names.add(m.group(1))
    for m in re.finditer(r'export\s+let\s+(\w+)', src):
        names.add(m.group(1))
    return names

def main():
    built_files = []
    for r, d, files in os.walk(os.path.join(ROOT, 'js')):
        for f in files:
            if f.endswith('.js'):
                built_files.append(os.path.join(r, f))

    real_problems = []
    missing = set()
    for f in built_files:
        src = open(f).read()
        base = os.path.dirname(f)
        for m in re.finditer(r'import\s*\{([^}]+)\}\s*from\s*[\'"](\..*?)[\'"]', src):
            names = [n.strip().split(' as ')[0] for n in m.group(1).split(',') if n.strip()]
            target = os.path.normpath(os.path.join(base, m.group(2)))
            ex = exports_of(target)
            if ex is None:
                missing.add(os.path.relpath(target, ROOT))
                continue
            for n in names:
                if n not in ex:
                    real_problems.append(f"{os.path.relpath(f, ROOT)}: '{n}' n'est pas exporté par {os.path.relpath(target, ROOT)}")

    print(f"Problèmes réels : {len(real_problems)}")
    for p in real_problems:
        print(" -", p)
    print(f"\nModules pas encore migrés référencés (attendu tant qu'ils n'existent pas) : {len(missing)}")
    for m in sorted(missing):
        print(" -", m)
    sys.exit(1 if real_problems else 0)

if __name__ == '__main__':
    main()
