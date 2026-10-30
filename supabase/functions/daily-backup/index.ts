import {backupHandler} from '../../../src/server-backup.js';
Deno.serve(backupHandler((name: string)=>Deno.env.get(name)));
