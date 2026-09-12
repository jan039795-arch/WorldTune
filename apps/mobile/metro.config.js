const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

/**
 * Metro dentro de un monorepo npm.
 *
 * Sin esto, la app no ve los paquetes compartidos (`@worldtune/api-client`)
 * porque viven fuera de su carpeta, y resuelve dos copias de React cuando npm
 * eleva dependencias a la raíz.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Los paquetes compartidos se consumen como TypeScript, sin paso de compilación.
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
