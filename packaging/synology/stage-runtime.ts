import { cpSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

/** Copy the installed production dependency graph without changing the lockfile. */
export function stageRuntimeDependencies(destination: string, root = process.cwd(), packages = ['jsdom']): void {
    const visited = new Set<string>();
    function copy(name: string, from: string): void {
        const manifest = require.resolve(`${name}/package.json`, { paths: [from] });
        const directory = dirname(manifest);
        if (visited.has(directory)) return;
        visited.add(directory);
        const target = relative(root, directory);
        if (!target.startsWith(`node_modules${sep}`)) throw new Error(`Dependency outside application: ${name}`);
        cpSync(directory, join(destination, target), {
            recursive: true,
            filter: source => {
                const parts = relative(directory, source).split(sep);
                return (
                    !parts.some(part => ['node_modules', 'test', 'tests', '__tests__', '.DS_Store'].includes(part)) &&
                    !/\.(map|ts)$|\.(test|spec)\.js$|\/\._[^/]*$/.test(source)
                );
            },
        });
        const metadata = JSON.parse(readFileSync(manifest, 'utf8'));
        for (const dependency of Object.keys(metadata.dependencies || {})) copy(dependency, directory);
    }
    for (const name of packages) copy(name, root);
}

if (import.meta.main) {
    if (!process.argv[2]) throw new Error('Runtime destination is required');
    stageRuntimeDependencies(process.argv[2]);
}
