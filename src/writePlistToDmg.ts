import * as ChildProcesses from "child_process";
import * as Plist from "macos-plist";
import { PlistValue } from "macos-plist";
import { Writable } from "stream";

function writePlist(plist: PlistValue, to: Writable): Promise<void> {
	return new Promise((resolve, reject) => {
		const pls = Plist.build(plist);
		to.write(pls, "UTF-8", error => {
			if (error)
				reject(error);
			else
				to.end(resolve);
		});
	});
}

export default async function writePlistToDmg(imagePath: string, plist: PlistValue): Promise<void> {
	const child = ChildProcesses.spawn("hdiutil", ["udifrez", "-xml", "/dev/fd/3", imagePath, imagePath], {
		stdio: ["inherit", "ignore", "inherit", "pipe"]
	});

	const childPromise = new Promise<void>((resolve, reject) => {
		let exited = false;

		const timeout = setTimeout(() => {
			if (!exited && !child.killed) {
				child.kill();
				reject(new Error("Timed out waiting for child process."));
			}
		}, 10000);

		child.on("error", error => {
			exited = true;
			clearTimeout(timeout);
			child.unref();
			reject(error);
		});

		child.on("exit", code => {
			exited = true;
			clearTimeout(timeout);
			child.unref();

			if (code) {
				reject(new Error(`Child process exited with code ${code}.`));
			} else {
				resolve();
			}
		});
	});

	const writing = writePlist(plist, child.stdio[3] as Writable);

	await Promise.all([childPromise, writing]);
}
