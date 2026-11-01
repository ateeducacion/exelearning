if (process.argv.includes('--synology-cgi')) {
    const { synologyCgiResponse } = await import('./auth-cgi');
    process.stdout.write(synologyCgiResponse(process.env));
} else {
    await import('../../src/index');
}
