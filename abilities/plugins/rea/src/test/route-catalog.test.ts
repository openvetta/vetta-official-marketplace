import { describe, expect, it } from "vitest";
import { inferRouteFromPath, isSelfContainedRoute, routeDefinition } from "../domain/route-catalog";

describe("route inference", () => {
	it("maps target extensions to the route REA would take", () => {
		expect(inferRouteFromPath("/Applications/Slack.app/Contents/Resources/app.asar").route).toBe("electron");
		expect(inferRouteFromPath("/tmp/app-release.apk").route).toBe("android");
		expect(inferRouteFromPath("/tmp/libengine.dylib").route).toBe("native");
		expect(inferRouteFromPath("/tmp/GameData.pck").route).toBe("artifact");
		expect(inferRouteFromPath("https://example.com/console").route).toBe("website");
	});

	it("says how sure it is instead of pretending", () => {
		const bundle = inferRouteFromPath("/Applications/Notes.app");
		expect(bundle.route).toBe("electron");
		expect(bundle.confidence).toBeLessThan(1);
		const unknown = inferRouteFromPath("/tmp/weird.xyz");
		expect(unknown.route).toBe("unknown");
		expect(unknown.confidence).toBeLessThan(0.2);
	});
});

describe("route catalogue", () => {
	it("declares the engine each route needs", () => {
		expect(routeDefinition("android").engines).toContain("jadx");
		expect(routeDefinition("native").engines).toEqual(expect.arrayContaining(["hopper", "ghidra", "ida", "kuna"]));
		expect(routeDefinition("website").engines).toEqual(["chrome"]);
	});

	it("marks byte-level routes as self contained", () => {
		expect(isSelfContainedRoute("dotnet")).toBe(true);
		expect(isSelfContainedRoute("artifact")).toBe(true);
		expect(isSelfContainedRoute("native")).toBe(false);
		expect(routeDefinition("unknown").id).toBe("unknown");
	});
});
