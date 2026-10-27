#!/usr/bin/env node
/**
 * Local patch for @conduction/nextcloud-vue (checked against 2.71.0 – 2.154.0).
 *
 * Bug: CnActionButtons falls back to a bare dispatchAction() when it is not
 * rendered inside a CnPageRenderer (no injected `cnDispatchAction`). That
 * fallback context has no `registry` and no `openModal`, so any `open-modal`
 * action outside a page - e.g. the sidebar "New request" primary action
 * (nav.primaryAction -> RequestCreateDialog) - logs
 *   [dispatchAction] open-modal target "RequestCreateDialog" not found in registry.
 * and does nothing.
 *
 * CnAppRoot already provides `cnRegistry` and `cnOpenModal` to every
 * descendant (including CnAppNav), so the fix is to inject `cnOpenModal` and
 * pass both into the fallback context.
 *
 * Runs from the `prebuild` npm script. Idempotent; fails the build loudly if
 * the library code has changed shape so the patch can be revisited.
 * Remove once fixed upstream.
 */
const fs = require('fs')
const path = require('path')

const file = path.join(
	__dirname, '..', 'node_modules', '@conduction', 'nextcloud-vue',
	'dist', 'esm', 'components', 'CnActionButtons', 'CnActionButtons.vue2.js',
)
const MARK = '/* pipelinq-patch: nav open-modal */'

let src = fs.readFileSync(file, 'utf8')
if (src.includes(MARK)) {
	console.log('[patch-nextcloud-vue] already patched')
	process.exit(0)
}

const injectAnchor = '\t\tcnDispatchAction: { default: null },'
const fallbackAnchor = '\t\t\t\topenRunNode: (a) => this.openRunNode(a),\n\t\t\t\t...extra,'

if (!src.includes(injectAnchor) || !src.includes(fallbackAnchor)) {
	console.error('[patch-nextcloud-vue] CnActionButtons has changed - patch no longer applies. '
		+ 'Check whether upstream fixed the nav open-modal registry bug and update/remove scripts/patch-nextcloud-vue.js.')
	process.exit(1)
}

src = src.replace(injectAnchor,
	injectAnchor + '\n\t\t' + MARK + '\n\t\tcnOpenModal: { default: null },')
src = src.replace(fallbackAnchor,
	'\t\t\t\topenRunNode: (a) => this.openRunNode(a),\n'
	+ '\t\t\t\t' + MARK + '\n'
	+ '\t\t\t\tregistry: this.cnRegistry,\n'
	+ '\t\t\t\topenModal: this.cnOpenModal || undefined,\n'
	+ '\t\t\t\t...extra,')

fs.writeFileSync(file, src)
console.log('[patch-nextcloud-vue] patched CnActionButtons fallback dispatch (registry + openModal)')
