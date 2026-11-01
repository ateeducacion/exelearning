/** DSM only accepts numeric components; order alpha < beta < rc < stable. */
export function synologyVersion(version: string, revision = '1'): string {
    const match = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta|rc)\.(0|[1-9]\d*))?$/.exec(version);
    if (!match) throw new Error('VERSION must be x.y.z or x.y.z-{alpha,beta,rc}.N');
    if (!/^[1-9]\d*$/.test(revision)) throw new Error('PACKAGE_REVISION must be a positive integer');
    const [, major, minor, patch, channel, sequence = '0'] = match;
    const stage = channel ? ['alpha', 'beta', 'rc'].indexOf(channel) : 3;
    const parts = [major, minor, patch, sequence, revision];
    if (parts.some(part => Number(part) > 2_147_483_647))
        throw new Error('Version component exceeds DSM integer range');
    return `${major}.${minor}.${patch}.${stage}.${sequence}-${revision}`;
}

if (import.meta.main) console.log(synologyVersion(process.argv[2] || '', process.argv[3] || '1'));
