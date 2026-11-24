import { cpus, totalmem } from 'os';

/**
 * Máquina modesta (até 6 GB de RAM ou até 4 núcleos, ex.: 4 GB + Intel i3):
 * o sistema economiza memória e processamento automaticamente.
 */
export const RAM_GB = Math.round((totalmem() / 1024 ** 3) * 10) / 10;
export const CPU_CORES = cpus().length;
export const LOW_END = totalmem() <= 6 * 1024 ** 3 || CPU_CORES <= 4;
/** IA local (Ollama/LM Studio) precisa de ~8 GB para não travar o computador. */
export const LOCAL_AI_OK = totalmem() >= 7.5 * 1024 ** 3;
export const isLocalProvider = (id?: string) => id === 'ollama' || id === 'lmstudio';
