import { SemanticExecutionGraphCompiler } from "./semantic-execution-graph/index.js";

const compiler = new SemanticExecutionGraphCompiler();

export async function compileSemanticExecutionGraph(_configuration, input) {
  return compiler.compile(input);
}
