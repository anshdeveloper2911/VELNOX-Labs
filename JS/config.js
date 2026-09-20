window.VELNOX_API = window.VELNOX_API || (
    location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://velnox-web-labs.onrender.com'
);
