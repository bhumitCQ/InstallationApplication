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
                    <div>
                        Rendering
                    </div>
                )
            }}
        >

        </AnimatedStepperLayout>
    )
}
