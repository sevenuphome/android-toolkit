import { describe, it, expect } from "vitest";
import { parseTaskOutput } from "../../src/services/gradleService";

describe("parseTaskOutput", () => {
  it("should parse grouped tasks", () => {
    const output = `> Task :tasks

------------------------------------------------------------
Tasks runnable from root project 'MyProject'
------------------------------------------------------------

Android tasks
-------------
androidDependencies - Displays the Android dependencies of the project.
signingReport - Displays the signing info for the base and test modules.

Build tasks
-----------
assemble - Assembles the outputs of this project.
assembleDebug - Assembles all Debug builds.
assembleRelease - Assembles all Release builds.
build - Assembles and tests this project.
clean - Deletes the build directory.

Verification tasks
------------------
check - Runs all checks.
lint - Runs lint on the default variant.
test - Run unit tests for all variants.

BUILD SUCCESSFUL in 2s
1 actionable task: 1 executed
`;

    const groups = parseTaskOutput(output);
    expect(groups).toHaveLength(3);

    expect(groups[0].name).toBe("Android tasks");
    expect(groups[0].tasks).toHaveLength(2);
    expect(groups[0].tasks[0].name).toBe("androidDependencies");
    expect(groups[0].tasks[0].description).toBe(
      "Displays the Android dependencies of the project."
    );

    expect(groups[1].name).toBe("Build tasks");
    expect(groups[1].tasks).toHaveLength(5);
    expect(groups[1].tasks[0].name).toBe("assemble");

    expect(groups[2].name).toBe("Verification tasks");
    expect(groups[2].tasks).toHaveLength(3);
  });

  it("should handle empty output", () => {
    const groups = parseTaskOutput("");
    expect(groups).toHaveLength(0);
  });

  it("should skip Tasks runnable header", () => {
    const output = `------------------------------------------------------------
Tasks runnable from root project 'MyProject'
------------------------------------------------------------

Build tasks
-----------
assemble - Assembles the outputs.
`;
    const groups = parseTaskOutput(output);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Build tasks");
  });
});
