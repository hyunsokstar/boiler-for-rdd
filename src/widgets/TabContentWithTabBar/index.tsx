'use client';

import React, { useState, useEffect } from 'react';
import { useTabBarStore, type PanelState, Tab } from '@/shared/model/tab-admin/store';
import {
    DndContext,
    DragOverlay,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
    useSensor,
    useSensors,
    PointerSensor,
    KeyboardSensor,
    closestCenter,
    defaultDropAnimation,
} from '@dnd-kit/core';
import {
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Resizable } from 're-resizable';
import { TabBarWithDndKit } from './ui/TabBarWithDndKit';

// 올바른 방식으로 드롭 애니메이션 구성
const dropAnimation = {
    ...defaultDropAnimation,
    // sideEffects는 함수여야 합니다
    sideEffects: ({ active }: { active: { node: HTMLElement } }) => {
        active.node.style.opacity = '0.5';

        // 클린업 함수 반환
        return () => {
            active.node.style.opacity = '';
        };
    }
};

// 초기 패널 크기 (로컬 스토리지에 저장됨)
const getPanelSizes = () => {
    if (typeof window === 'undefined') return {};

    try {
        const saved = localStorage.getItem('panel-sizes');
        return saved ? JSON.parse(saved) : {};
    } catch (e) {
        console.error('Failed to parse panel sizes:', e);
        return {};
    }
};

export function TabContentWithTabBar() {
    const {
        panels,
        screenCount,
        isSplitScreen,
        moveTab,
        updateSplitScreenCount
    } = useTabBarStore();

    const [activeTab, setActiveDragTab] = useState<Tab | null>(null);
    const [activePanel, setActivePanel] = useState<string | null>(null);
    const [panelSizes, setPanelSizes] = useState<Record<string, { width?: string | number, height?: string | number }>>({});
    const [hoveredPanel, setHoveredPanel] = useState<string | null>(null);

    // 로컬 스토리지에서 패널 크기 로드
    useEffect(() => {
        setPanelSizes(getPanelSizes());
    }, []);

    // 패널 크기 변경 시 로컬 스토리지에 저장
    const handleResizeStop = (panelId: string, size: { width: number, height: number }) => {
        const newSizes = {
            ...panelSizes,
            [panelId]: size
        };

        setPanelSizes(newSizes);

        try {
            localStorage.setItem('panel-sizes', JSON.stringify(newSizes));
        } catch (e) {
            console.error('Failed to save panel sizes:', e);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const { tab, panelId } = active.data.current || {};

        if (tab && panelId) {
            console.log('Drag started:', { tab, panelId });
            setActiveDragTab(tab);
            setActivePanel(panelId);
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        // 필요한 경우 여기에 드래그 오버 로직 추가
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || !active.data.current) {
            setActiveDragTab(null);
            setActivePanel(null);
            return;
        }

        console.log('Drag ended:', {
            activeId: active.id,
            activeData: active.data.current,
            overId: over.id,
            overData: over.data.current
        });

        const sourceTabId = active.id as string;
        const sourcePanelId = active.data.current.panelId;

        // 드롭 영역에서 패널 ID 추출
        let targetPanelId = sourcePanelId;

        if (over.data.current?.panelId) {
            targetPanelId = over.data.current.panelId;
            console.log(`Moving tab to panel: ${targetPanelId} (from data)`);
        } else if (over.data.current?.type === 'panel-area') {
            // droppable-panel-1 형식에서 panel-1 추출
            const match = (over.id as string).match(/droppable-(.+)/);
            if (match && match[1]) {
                targetPanelId = match[1];
                console.log(`Moving tab to panel: ${targetPanelId} (from id)`);
            }
        }

        // 패널 간 이동이 있을 경우만 처리
        if (sourcePanelId !== targetPanelId) {
            console.log(`Moving tab ${sourceTabId} from ${sourcePanelId} to ${targetPanelId}`);
            moveTab(sourceTabId, sourcePanelId, targetPanelId);
        }

        setActiveDragTab(null);
        setActivePanel(null);
    };

    const getGridClass = () => {
        const gridClasses = {
            1: 'grid-cols-1',
            2: 'grid-cols-2',
            3: 'grid-cols-3',
            4: 'grid-cols-4',
            5: 'grid-cols-5'
        };
        return gridClasses[screenCount] || 'grid-cols-1';
    };

    const handleRemovePanel = (panelId: string) => {
        const newScreenCount = screenCount - 1;
        updateSplitScreenCount((newScreenCount > 0 ? newScreenCount : 1) as 1 | 2 | 3 | 4 | 5);
    };

    const renderPanel = (panel: PanelState) => {
        const ActiveTabContent = panel.activeTabId
            ? panel.tabs.find(tab => tab.id === panel.activeTabId)?.component
            : null;

        return (
            <div className="flex flex-col h-full border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <TabBarWithDndKit
                    panel={panel}
                    onRemovePanel={() => handleRemovePanel(panel.id)}
                    showRemoveButton={screenCount > 1}
                />

                <div className="flex-1 overflow-auto p-4" data-panel-id={panel.id}>
                    {ActiveTabContent ? <ActiveTabContent /> : (
                        <div className="h-full flex items-center justify-center text-gray-400">
                            <p>콘텐츠를 선택해주세요</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (panels.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                    <p className="text-xl">환영합니다</p>
                    <p className="mt-2">좌측 메뉴에서 원하는 기능을 선택하세요</p>
                </div>
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            {!isSplitScreen ? (
                renderPanel(panels[0])
            ) : (
                <div className="overflow-x-auto h-full">
                    <div className="flex h-full" style={{ minWidth: 'fit-content' }}>
                        {panels.map((panel, index) => {
                            // 마지막 패널은 resize 핸들이 필요 없음
                            const isLastPanel = index === panels.length - 1;
                            const panelSize = panelSizes[panel.id] || {};
                            const isPanelHovered = hoveredPanel === panel.id;

                            return (
                                <Resizable
                                    key={panel.id}
                                    size={{
                                        width: panelSize.width || `${100 / screenCount}%`,
                                        height: panelSize.height || '100%',
                                    }}
                                    minWidth="200px"
                                    maxWidth="3000px" // 충분히 큰 값 설정
                                    enable={{
                                        top: false,
                                        right: !isLastPanel,
                                        bottom: false,
                                        left: false,
                                        topRight: false,
                                        bottomRight: false,
                                        bottomLeft: false,
                                        topLeft: false,
                                    }}
                                    onResizeStop={(e, direction, ref, d) => {
                                        handleResizeStop(panel.id, {
                                            width: ref.offsetWidth,
                                            height: ref.offsetHeight
                                        });
                                    }}
                                    // className="transition-all duration-150"
                                    handleClasses={{
                                        right: `w-1 absolute top-0 bottom-0 right-0 transition-opacity duration-200 ${isPanelHovered ? 'opacity-100' : 'opacity-0'
                                            }`
                                    }}
                                    handleStyles={{
                                        right: {
                                            width: '8px',
                                            right: '-4px',
                                            backgroundColor: isPanelHovered ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                                            cursor: 'col-resize',
                                            zIndex: 10
                                        }
                                    }}
                                >
                                    <div
                                        className="bg-white rounded-lg h-full p-1 relative"
                                        id={panel.id}
                                        data-panel-id={panel.id}
                                        onMouseEnter={() => setHoveredPanel(panel.id)}
                                        onMouseLeave={() => setHoveredPanel(null)}
                                    >
                                        {renderPanel(panel)}

                                        {/* 리사이징 핸들 호버 상태 시각화를 위한 요소 */}
                                        {!isLastPanel && (
                                            <div
                                                className={`absolute top-0 bottom-0 right-0 w-1 z-10 transition-opacity duration-200 ${isPanelHovered ? 'opacity-100 bg-blue-300' : 'opacity-0'
                                                    }`}
                                            />
                                        )}
                                    </div>
                                </Resizable>
                            );
                        })}
                    </div>
                </div>
            )}

            <DragOverlay dropAnimation={dropAnimation}>
                {activeTab ? (
                    <div className="flex items-center px-3 py-1.5 h-8 border border-blue-400 bg-blue-50 rounded-md min-w-[120px] shadow-lg">
                        <span className="text-xs font-medium truncate flex-1">
                            {activeTab.label}
                        </span>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

export default TabContentWithTabBar;