(async () => {
    try {
        const state = new URLSearchParams(location.search).get('state');
        if (!state || !/^[\w-]{43}$/.test(state)) throw new Error('Invalid login state.');
        // DSM supplies its existing session's CSRF token; it is never put in a URL.
        const options = { credentials: 'same-origin', cache: 'no-store', redirect: 'error' };
        const response = await fetch('/webman/login.cgi', options);
        if (!response.ok) throw new Error('DSM session validation is unavailable.');
        const session = await response.json();
        if (session.success !== true) throw new Error('Sign in to DSM and open eXeLearning again.');
        const headers = { Accept: 'application/json' };
        if (typeof session.SynoToken === 'string' && session.SynoToken) headers['X-Syno-Token'] = session.SynoToken;
        const login = await fetch(`/webman/3rdparty/exelearning/auth.cgi?state=${state}`, { ...options, headers });
        if (login.status !== 204) throw new Error('DSM session validation failed. Open eXeLearning from DSM again.');
        // A navigation drops the DSM token header before entering the application.
        location.replace(`/exelearning/login/synology/callback?state=${state}`);
    } catch {
        document.querySelector('[role="status"]').textContent =
            'Unable to validate the DSM session. Sign in to DSM and open eXeLearning again.';
    }
})();
