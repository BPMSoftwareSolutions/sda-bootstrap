import { sha256 } from "../../../primitives/sha256.js";
export function renderPythonProgram() {
    return "# GENERATED PURE PROJECTION SEAM. Do not hand-edit.\nfrom scenario_kernel.platform.consumer import main\n\nraise SystemExit(main(__file__))\n";
}
export class PythonConsumerApplicationProvider {
    target = "python";
    render(_input) {
        const content = renderPythonProgram();
        return Object.freeze([{
                relativePath: "python/consumer.generated.py",
                content,
                digest: sha256(content),
                sourcePointers: ["languages/python/src/scenario_kernel/platform/consumer.py"],
                target: "python"
            }]);
    }
}
