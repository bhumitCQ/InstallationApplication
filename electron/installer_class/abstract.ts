import Dockerode from "dockerode";
import { ipcMain } from "electron";

type InstallerConfig = {
    requiredImage?: Array<string>,
}

export abstract class Installer {
    #currentStep: null | number;
    #requiredImage: Array<string>;
    protected dockerInstance: null | Dockerode  = null; 
    constructor(config: InstallerConfig = {}) {
        this.#currentStep = null;
        this.#requiredImage = config.requiredImage ?? []; 
        try {
            this.dockerInstance  = new Dockerode({});
        } catch (error) { }
    }
   
    abstract executeStep(step: number): Promise<import('mitt').Emitter<{}>>

    async checkDockerVersion(): Promise<false | string> {
        const startTime = Date.now();
        const endTime = startTime + 30 * 1000;
        while (Date.now() < endTime) {
            try {
                if (!this.dockerInstance) {
                    return false;
                }
                const version = await this.dockerInstance.version();
                console.log('Docker Versin', version);
                return version.Version;
            } catch (erro) {
            }
        }
        return false;
    }

    async checkForImages(): Promise<Array<string>> {
        const imagesNotPresent = this.#requiredImage.filter((image) => {    
            const imageInfo = this.dockerInstance!.getImage(image);
            if (imageInfo.id) {
                return false;
            }
            return true;
        });
        return imagesNotPresent;
    }

    async downloadImage(image: string): Promise<void> {
        const imagesRequiredToBeLoaded = await this.checkForImages();
        for (let image of imagesRequiredToBeLoaded) {
            await new Promise((resolve, reject) => {
                this.dockerInstance!.pull(image, {}, (err, result) => {
                    console.log(err);
                    console.log(result);
                    resolve([err, result])
                });
            });
        }
    }

    abstract checkCurrentStep(): Promise<number>
    abstract moveToNextStep(): Promise<boolean>
    abstract restart(): Promise<void>
}