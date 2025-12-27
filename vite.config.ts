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
                const names = files.map(f => f.replace('.2de7', ''));
                console.log(`[API] Serving ${names.length} levels:`, names);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(names));
            }
            else if (req.url === '/api/save-level' && req.method === 'POST') {
                let chunks: any[] = [];
                req.on('data', chunk => chunks.push(chunk));
                req.on('end', () => {
                    try {
                        const body = Buffer.concat(chunks).toString();
                        if (!body) throw new Error("Empty request body");
                        const { name, data } = JSON.parse(body);
                        if (!name) throw new Error("Missing level name");

                        const dir = path.resolve(process.cwd(), 'levels');
                        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                        const filePath = path.join(dir, `${name}.2de7`);
                        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                        console.log(`[API] Successfully saved level: ${name} (${Math.round(body.length / 1024)} KB)`);
                        res.statusCode = 200;
                        res.end('ok');
                    } catch (err: any) {
                        console.error('[API] Save failed:', err.message);
                        res.statusCode = 500;
                        res.end(`fail: ${err.message}`);
                    }
                });
            }
            else if (req.url === '/api/delete-level' && req.method === 'POST') {
                let chunks: any[] = [];
                req.on('data', chunk => chunks.push(chunk));
                req.on('end', () => {
                    try {
                        const body = Buffer.concat(chunks).toString();
                        const { name } = JSON.parse(body);
                        if (!name) throw new Error("Missing level name");

                        const filePath = path.resolve(process.cwd(), 'levels', `${name}.2de7`);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            console.log(`[API] Successfully deleted level: ${name}`);
                            res.statusCode = 200;
                            res.end('ok');
                        } else {
                            throw new Error("Level not found");
                        }
                    } catch (err: any) {
                        console.error('[API] Delete failed:', err.message);
                        res.statusCode = 500;
                        res.end(`fail: ${err.message}`);
                    }
                });
            }
            else if (req.url === '/api/rename-level' && req.method === 'POST') {
                let chunks: any[] = [];
                req.on('data', chunk => chunks.push(chunk));
                req.on('end', () => {
                    try {
                        const body = Buffer.concat(chunks).toString();
                        const { oldName, newName } = JSON.parse(body);
                        if (!oldName || !newName) throw new Error("Missing names");

                        const oldPath = path.resolve(process.cwd(), 'levels', `${oldName}.2de7`);
                        const newPath = path.resolve(process.cwd(), 'levels', `${newName}.2de7`);

                        if (!fs.existsSync(oldPath)) throw new Error("Source level not found");
                        if (fs.existsSync(newPath)) throw new Error("Target name already exists");

                        fs.renameSync(oldPath, newPath);
                        console.log(`[API] Renamed ${oldName} to ${newName}`);
                        res.statusCode = 200;
                        res.end('ok');
                    } catch (err: any) {
                        console.error('[API] Rename failed:', err.message);
                        res.statusCode = 500;
                        res.end(`fail: ${err.message}`);
                    }
                });
            }
            else if (req.url?.startsWith('/api/load-level') && req.method === 'GET') {
                const url = new URL(req.url, `http://${req.headers.host}`);
                const name = url.searchParams.get('name');
                console.log(`[API] Loading level: ${name}`);
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
