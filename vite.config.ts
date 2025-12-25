import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const levelStorage = () => ({
    name: 'level-storage',
    configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
            if (req.url === '/api/levels' && req.method === 'GET') {
                const dir = path.resolve(process.cwd(), 'levels');
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                const files = fs.readdirSync(dir).filter(f => f.endsWith('.2de7'));
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(files.map(f => f.replace('.2de7', ''))));
            }
            else if (req.url === '/api/save-level' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    const { name, data } = JSON.parse(body);
                    const dir = path.resolve(process.cwd(), 'levels');
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(path.join(dir, `${name}.2de7`), JSON.stringify(data, null, 2));
                    res.end('ok');
                });
            }
            else if (req.url?.startsWith('/api/load-level') && req.method === 'GET') {
                const url = new URL(req.url, `http://${req.headers.host}`);
                const name = url.searchParams.get('name');
                const filePath = path.resolve(process.cwd(), 'levels', `${name}.2de7`);
                if (fs.existsSync(filePath)) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(fs.readFileSync(filePath));
                } else {
                    res.statusCode = 404;
                    res.end('Not found');
                }
            }
            else {
                next();
            }
        });
    }
});

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), levelStorage()],
})
