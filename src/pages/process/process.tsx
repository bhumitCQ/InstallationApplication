import { EnableWsl } from '@/components/enable-wsl';
import { InstallDocker } from '@/components/install-docker';
import { InstallWSL } from '@/components/install-wsl';
import { AnimatedStepperLayout } from '@/components/steps/steps';
import { Spinner } from '@/components/ui/shadcn-io/spinner';
import { useQuery } from '@tanstack/react-query';
import React from 'react';

export const ProcessPage = () => {
    const currentProgressStep = useQuery({
        queryKey: ['platform-status'],
        queryFn: async () => {
            const currentProgressStep = (await window.ipcRenderer?.invoke('get-current-step')) as number;
            console.log({ currentProgressStep });
            return currentProgressStep ?? 1;
            return 0;
        },
        refetchInterval: 2000,
        refetchOnWindowFocus: false,
        staleTime: 0,
        retry: false,
    });

    if (currentProgressStep.isLoading || currentProgressStep.error) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <div className="flex flex-col items-center justify-center gap-3">
                    <div className="h-12 w-12 flex items-center justify-center">
                        <Spinner size="lg" />
                    </div>
                    <p className="text-sm text-gray-600">
                        Please wait, loading your progress...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <AnimatedStepperLayout
            activeIndex={currentProgressStep.data ?? 1}
            steps={[
                {
                    key: "step-1",
                    title: "Enable WSL",
                    description: "Enableing WSL in the system",
                },
                {
                    key: "step-2",
                    title: "Installing WSL",
                    description: "Installing WSL Version 2",
                },
                {
                    key: "step-3",
                    title: "Install Docker",
                    description: "Installing Docker",
                },
                {
                    key: "step-4",
                    title: "Installation Compleated",
                    description: "Installation Completed",
                }
            ]}
            renderMain={(activeStep, activeIndex) => {
                if (activeIndex === 0) {
                    return <EnableWsl />
                }
                if (activeIndex === 1) {
                    return <InstallWSL />
                }
                if (activeIndex === 2) {
                    return <InstallDocker />
                }
                return (
                    <div className="h-full w-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="text-2xl font-semibold">Thank you! Installation is complete.</div>
                            <div className="text-sm text-gray-600 max-w-md">
                                You can now close this installer. Docker and WSL have been installed and configured.
                            </div>
                            <button
                                onClick={async () => {
                                    try {
                                        await window.ipcRenderer?.invoke('app-quit');
                                    } catch (e) {
                                        window.close();
                                    }
                                }}
                                className="inline-flex items-center justify-center rounded-md bg-black text-white px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )
            }}
        >

        </AnimatedStepperLayout>
    )
}
