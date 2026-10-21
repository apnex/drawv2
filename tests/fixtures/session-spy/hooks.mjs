// the resolve hook register.mjs installs: the adapter's import of the component, and no other, answered by the logging wrapper
export async function resolve(specifier, context, next) {
	if (specifier === '@apnex/input-binding' && context.parentURL?.endsWith('/kernel/input-rules.mjs')) {
		return { url: new URL('./wrapper.mjs', import.meta.url).href, shortCircuit: true };
	}
	return next(specifier, context);
}
