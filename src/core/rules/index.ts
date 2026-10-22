import { RuleDefinition, RuleFamily } from '../types';
import { UNI_RULES } from './uni';
import { HID_RULES } from './hid';
import { INJ_RULES } from './inj';
import { EXF_RULES } from './exf';
import { MCP_RULES } from './mcp';
import { EXEC_RULES } from './exec';
import { OBF_RULES } from './obf';
import { SEC_RULES } from './sec';

export const ALL_RULES: ReadonlyArray<RuleDefinition> = [
  ...UNI_RULES,
  ...HID_RULES,
  ...INJ_RULES,
  ...EXF_RULES,
  ...MCP_RULES,
  ...EXEC_RULES,
  ...OBF_RULES,
  ...SEC_RULES,
];

export const RULE_FAMILIES: ReadonlyArray<{
  family: RuleFamily;
  name: string;
  shortDesc: string;
}> = [
  {
    family: 'UNI',
    name: 'Deceptive Unicode',
    shortDesc: 'Zero-width characters, Unicode Tag ASCII smuggling, Bidi overrides, homoglyphs',
  },
  {
    family: 'HID',
    name: 'Hidden Markup',
    shortDesc: 'Instructions inside HTML comments, display:none blocks, and alt/title attributes',
  },
  {
    family: 'INJ',
    name: 'Prompt Injection',
    shortDesc: 'Instruction overrides, "do not tell the user" directives, system prompt spoofing',
  },
  {
    family: 'EXF',
    name: 'Secret Exfiltration',
    shortDesc: 'Commands telling an agent to read .env / ~/.ssh or transmit data externally',
  },
  {
    family: 'MCP',
    name: 'Risky MCP Config',
    shortDesc: 'Unpinned npx/uvx servers, plain HTTP, broad root mounts, tool description poisoning',
  },
  {
    family: 'EXEC',
    name: 'Auto-Run Hooks',
    shortDesc: 'package.json install scripts, VS Code folderOpen tasks, devcontainer hooks',
  },
  {
    family: 'OBF',
    name: 'Encoded Payloads',
    shortDesc: 'Base64 and Hex blobs that decode into hidden agent instructions',
  },
  {
    family: 'SEC',
    name: 'Leaked Secrets',
    shortDesc: 'Committed API tokens and private key headers (always redacted)',
  },
];

export {
  UNI_RULES,
  HID_RULES,
  INJ_RULES,
  EXF_RULES,
  MCP_RULES,
  EXEC_RULES,
  OBF_RULES,
  SEC_RULES,
};
