import React, { useState, useEffect, useRef, useMemo, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useTranslation } from 'react-i18next';
import { Page, Task, Category, CompletedTask, Achievement, Theme, Font, FontSize, User } from './types.ts';
import dayjs from 'dayjs';
import { notificationService, createDefaultTasks, dataService } from './services.ts';
import { 
    LayoutDashboard, History, BarChart2, Settings as SettingsIcon, Info, Sun, Moon, Palette, Type, CheckCircle, Plus, Edit2, Trash2, GripVertical, Calendar, Download, Trophy, Clock, List, LayoutGrid, Search, X, ChevronsUpDown, Upload, FileText
} from 'lucide-react';

declare const html2canvas: any;
declare const jspdf: any;

const darkenColor = (hex: string | undefined, percent: number): string => {
    if (!hex || !hex.startsWith('#')) return hex || '#000000';
    
    let color = hex.substring(1);
    if (color.length === 3) {
      color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
    }
    
    const num = parseInt(color, 16);
    let r = (num >> 16);
    let g = (num >> 8) & 0x00FF;
    let b = num & 0x0000FF;

    r = Math.round(r * (1 - percent));
    g = Math.round(g * (1 - percent));
    b = Math.round(b * (1 - percent));

    if (r < 0) r = 0;
    if (g < 0) g = 0;
    if (b < 0) b = 0;
    
    const newColor = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    return "#" + newColor;
};

const ICONS: { [key in Page]: React.ReactNode } = {
    dashboard: <LayoutDashboard size={20} />,
    history: <History size={20} />,
    stats: <BarChart2 size={20} />,
    settings: <SettingsIcon size={20} />,
    about: <Info size={20} />,
};

const PRIORITY_STYLES: { [key in Task['priority']]: string } = {
    high: 'border-red-500',
    medium: 'border-amber-500',
    low: 'border-sky-500'
};

export const Navbar: React.FC<{ activePage: Page, setActivePage: (page: Page) => void }> = ({ activePage, setActivePage }) => {
    const { t } = useTranslation();
    const pages: Page[] = ['dashboard', 'history', 'stats', 'settings', 'about'];
    
    return (
        <nav className="fixed top-0 left-0 right-0 bg-[var(--bg-card)] backdrop-blur-lg border-b border-[var(--border-color)] z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <span className="font-bold text-xl text-[var(--text-accent)]">Zenith</span>
                    </div>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            {pages.map((page) => (
                                <button key={page} onClick={() => setActivePage(page)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                        activePage === page 
                                        ? 'bg-[var(--accent-primary)] text-white shadow-lg' 
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                                    aria-current={activePage === page ? 'page' : undefined}
                                >
                                    {ICONS[page]}
                                    {t(page)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export const TaskItem: React.FC<{ task: Task; category: Category | undefined; onUpdate: (task: Task) => void; onDelete: (id: string) => void; onEdit: (task: Task) => void; onToggleSelect: (taskId: string) => void; isSelected: boolean; isCurrent: boolean; onDragStart: (e: React.DragEvent<HTMLLIElement>, task: Task) => void; onDragOver: (e: React.DragEvent<HTMLLIElement>) => void; onDrop: (e: React.DragEvent<HTMLLIElement>, task: Task) => void; }> = ({ task, category, onUpdate, onDelete, onEdit, onToggleSelect, isSelected, isCurrent, onDragStart, onDragOver, onDrop }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let interval: any;
        if (task.status === 'in-progress' && task.endTime > task.startTime) {
            const updateProgress = () => {
                const now = Date.now();
                const total = task.endTime - task.startTime;
                const elapsed = now - task.startTime;
                const newProgress = Math.min(100, Math.max(0, (elapsed / total) * 100));
                setProgress(newProgress);
            };
            updateProgress();
            interval = setInterval(updateProgress, 1000 * 60);
        } else {
             setProgress(0);
        }
        return () => clearInterval(interval);
    }, [task.status, task.startTime, task.endTime]);

    const handleStatusChange = () => {
        onUpdate({ ...task, status: task.status === 'completed' ? 'pending' : 'completed' });
    };

    const motionProps = { layout: true, initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, x: -50 } };
    const cardBg = task.status === 'completed' ? 'bg-green-900/20' : 'bg-[var(--bg-card)]';
    const glowClass = isCurrent ? `shadow-lg ring-2 ring-[var(--glow-color)]` : '';
    const glowStyle = isCurrent ? {boxShadow: `0 0 15px 0px var(--glow-color)`} : {};
    
    return (
        <motion.li {...motionProps} draggable onDragStart={(e) => onDragStart(e as any, task)} onDragOver={onDragOver} onDrop={(e) => onDrop(e, task)} style={glowStyle}
            className={`flex items-start p-3 rounded-lg mb-3 transition-all duration-300 border-l-4 ${PRIORITY_STYLES[task.priority]} ${cardBg} ${glowClass}`}>
            <GripVertical className="mr-2 mt-1.5 text-[var(--text-secondary)] cursor-grab active:cursor-grabbing" size={20} aria-hidden="true"/>
            <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(task.id)} className="form-checkbox h-5 w-5 mt-1.5 rounded bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-accent)] focus:ring-[var(--text-accent)] mr-4" aria-label={`Select task: ${task.title}`}/>
            <div className="flex-grow">
                <div className="flex justify-between items-start">
                    <span className={`font-semibold ${task.status === 'completed' ? 'text-[var(--text-secondary)] line-through' : ''}`}>{task.title}</span>
                    {category && <span className="text-xs font-bold px-2 py-1 rounded-full text-white" style={{backgroundColor: category.color}}>{category.name}</span>}
                </div>
                {task.description && <p className="text-sm text-[var(--text-secondary)] mt-1">{task.description}</p>}
                <div className="text-xs text-[var(--text-accent)] mt-2 flex items-center gap-1">
                    <Clock size={12} />
                    {dayjs(task.startTime).format('h:mm A')} - {dayjs(task.endTime).format('h:mm A')}
                </div>
                {task.status === 'in-progress' && (
                    <div className="w-full bg-[var(--bg-secondary)] rounded-full h-1.5 mt-2" aria-label={`Task progress: ${progress.toFixed(0)}%`}>
                        <div className="bg-[var(--accent-primary)] h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                )}
            </div>
            <div className="flex flex-col items-center space-y-2 ml-4">
                <button onClick={handleStatusChange} className={`p-1 rounded-full text-xs transition-colors ${task.status === 'completed' ? 'bg-green-500' : 'bg-transparent border-2 border-[var(--text-secondary)]'}`} aria-label={`Mark as ${task.status === 'completed' ? 'pending' : 'completed'}`}>
                   {task.status === 'completed' ? <CheckCircle size={16} className="text-white"/> : <div className="w-4 h-4"></div>}
                </button>
                <button onClick={() => onEdit(task) } className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-accent)]" aria-label={`Edit task: ${task.title}`}><Edit2 size={16}/></button>
                <button onClick={() => onDelete(task.id)} className="p-1 text-[var(--text-secondary)] hover:text-red-400" aria-label={`Delete task: ${task.title}`}><Trash2 size={16}/></button>
            </div>
        </motion.li>
    );
};

export const TaskManager: React.FC<{ tasks: Task[]; categories: Category[]; onTasksChange: (tasks: Task[]) => void; onTaskComplete: (task: Task) => void; onTaskSave: (task: Task) => void; currentTaskId: string | null; }> = ({ tasks, categories, onTasksChange, onTaskComplete, onTaskSave, currentTaskId }) => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<Task['status'] | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
    const draggingTask = useRef<Task | null>(null);

    const handleAddTaskClick = () => { setEditingTask(null); setIsModalOpen(true); };
    const handleEditTask = (task: Task) => { setEditingTask(task); setIsModalOpen(true); };
    const handleSaveTask = (task: Task) => { onTaskSave(task); if(task.status === 'completed') onTaskComplete(task); setIsModalOpen(false); setEditingTask(null); };
    const handleDeleteTask = (id: string) => { onTasksChange(tasks.filter(task => task.id !== id)); notificationService.cancelTaskNotifications(id); };
    const handleUpdateTask = (updatedTask: Task) => { if(updatedTask.status === 'completed') onTaskComplete(updatedTask); onTasksChange(tasks.map(task => task.id === updatedTask.id ? updatedTask : task)); notificationService.scheduleTaskNotifications(updatedTask); };
    const handleDragStart = (e: React.DragEvent<HTMLLIElement>, task: Task) => { draggingTask.current = task; };
    const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => e.preventDefault();
    const handleDrop = (e: React.DragEvent<HTMLLIElement>, dropTargetTask: Task) => {
        e.preventDefault();
        if (draggingTask.current && dropTargetTask.id !== draggingTask.current.id) {
            let newTasks = [...tasks];
            const dragIndex = tasks.findIndex(t => t.id === draggingTask.current!.id);
            const dropIndex = tasks.findIndex(t => t.id === dropTargetTask.id);
            const [removed] = newTasks.splice(dragIndex, 1);
            newTasks.splice(dropIndex, 0, removed);
            onTasksChange(newTasks.map((t, index) => ({ ...t, order: index })));
        }
        draggingTask.current = null;
    };
    const handleToggleSelect = (taskId: string) => setSelectedTasks(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
    const handleBulkDelete = () => { onTasksChange(tasks.filter(t => !selectedTasks.includes(t.id))); selectedTasks.forEach(id => notificationService.cancelTaskNotifications(id)); setSelectedTasks([]); };
    const handleBulkComplete = () => { onTasksChange(tasks.map(t => selectedTasks.includes(t.id) ? { ...t, status: 'completed' as const } : t)); tasks.filter(t => selectedTasks.includes(t.id)).forEach(onTaskComplete); setSelectedTasks([]); };
    const filteredTasks = useMemo(() => tasks.filter(t => searchTerm === '' || t.title.toLowerCase().includes(searchTerm.toLowerCase())).filter(t => statusFilter === 'all' || t.status === statusFilter).filter(t => categoryFilter === 'all' || t.categoryId === categoryFilter).sort((a,b) => a.order - b.order), [tasks, searchTerm, statusFilter, categoryFilter]);
    
    return (
        <GlassCard className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-[var(--text-accent)]">{t('taskManager')}</h3>
                <button onClick={handleAddTaskClick} className="flex items-center gap-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white font-bold py-2 px-4 rounded-lg"><Plus size={20}/>{t('addTask')}</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                <div className="relative"><label htmlFor="search-tasks" className="sr-only">Search Tasks</label><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} /><input id="search-tasks" type="text" placeholder="Search tasks..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-2 pl-10 focus:outline-none focus:ring-2 focus:ring-[var(--text-accent)]" /></div>
                <div><label htmlFor="status-filter" className="sr-only">Filter by Status</label><select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[var(--text-accent)]"><option value="all">All Statuses</option><option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="completed">Completed</option></select></div>
                <div><label htmlFor="category-filter" className="sr-only">Filter by Category</label><select id="category-filter" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[var(--text-accent)]"><option value="all">All Categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            </div>
            <AnimatePresence>{selectedTasks.length > 0 && (<motion.div initial={{opacity: 0, y: -10}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -10}} className="flex items-center justify-between bg-[var(--bg-secondary)] p-2 rounded-lg mb-4"><span className="text-sm font-semibold">{selectedTasks.length} task(s) selected</span><div className="flex items-center gap-2"><button onClick={handleBulkComplete} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded-md text-sm">Mark Done</button><button onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded-md text-sm">Delete</button><button onClick={() => setSelectedTasks([])} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]" aria-label="Clear selection"><X size={18}/></button></div></motion.div>)}</AnimatePresence>
            <ul className="flex-grow overflow-y-auto pr-2"><AnimatePresence>{filteredTasks.length > 0 ? filteredTasks.map(task => (<TaskItem key={task.id} task={task} category={categories.find(c => c.id === task.categoryId)} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} onEdit={handleEditTask} onToggleSelect={handleToggleSelect} isSelected={selectedTasks.includes(task.id)} isCurrent={task.id === currentTaskId} onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop} />)) : <p className="text-[var(--text-secondary)] text-center mt-8">{t('noTasks')}</p>}</AnimatePresence></ul>
            <AnimatePresence>{isModalOpen && <TaskModal task={editingTask} categories={categories} onSave={handleSaveTask} onClose={() => setIsModalOpen(false)} />}</AnimatePresence>
        </GlassCard>
    );
};

export const Timeline: React.FC<{ tasks: Task[], categories: Category[], currentTaskId: string | null }> = ({ tasks, categories, currentTaskId }) => {
    const { t } = useTranslation();
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 60000); return () => clearInterval(timer); }, []);
    const totalMinutesInDay = 24 * 60;
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const currentTimePosition = (currentMinutes / totalMinutesInDay) * 100;
    const todaysTasks = tasks.filter(task => dayjs(task.startTime).isSame(dayjs(), 'day'));

    return (
        <GlassCard className="h-full relative overflow-hidden">
            <h3 className="text-xl font-bold mb-4 text-[var(--text-accent)]">{t('todaysSchedule')}</h3>
            <div className="relative h-[calc(100%-40px)] overflow-y-auto">
                <div className="absolute left-10 right-0" style={{ top: `${currentTimePosition}%`, zIndex: 20 }}>
                    <div className="relative h-px bg-red-400"><div className="absolute -left-2 -top-1.5 h-3 w-3 rounded-full bg-red-400"></div></div>
                </div>
                <div className="relative">
                    {hours.map(hour => (<div key={hour} className="flex items-center h-20 border-b border-[var(--border-color)]"><div className="w-10 text-right text-xs text-[var(--text-secondary)] pr-2">{dayjs().hour(hour).minute(0).format('ha')}</div><div className="flex-1 h-full"></div></div>))}
                    {todaysTasks.map(task => {
                        const start = dayjs(task.startTime), end = dayjs(task.endTime);
                        const durationMinutes = end.diff(start, 'minute');
                        const topPercent = (start.hour() * 60 + start.minute()) / totalMinutesInDay * 100;
                        const heightPercent = durationMinutes / totalMinutesInDay * 100;
                        const category = categories.find(c => c.id === task.categoryId);
                        const isCurrent = task.id === currentTaskId;
                        const glowStyle = isCurrent ? {boxShadow: `0 0 15px 0px var(--glow-color)`} : {};
                        return (
                            <div key={task.id} style={{ top: `${topPercent}%`, height: `${heightPercent}%`, backgroundColor: category?.color, borderColor: darkenColor(category?.color, 0.2), ...glowStyle }}
                                className={`absolute left-14 right-2 p-2 rounded-lg text-white/90 text-sm shadow-lg border transition-all ${isCurrent ? 'z-10' : ''}`}>
                                <p className="font-bold">{task.title}</p><p className="text-xs">{start.format('h:mm A')} - {end.format('h:mm A')}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </GlassCard>
    );
};

export const TaskModal: React.FC<{task: Task | null, categories: Category[], onSave: (task: Task) => void, onClose: () => void}> = ({task, categories, onSave, onClose}) => {
    const [title, setTitle] = useState(task?.title || '');
    const [description, setDescription] = useState(task?.description || '');
    const [startTime, setStartTime] = useState(task ? dayjs(task.startTime).format('YYYY-MM-DDTHH:mm') : dayjs().format('YYYY-MM-DDTHH:mm'));
    const [endTime, setEndTime] = useState(task ? dayjs(task.endTime).format('YYYY-MM-DDTHH:mm') : dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'));
    const [priority, setPriority] = useState<Task['priority']>(task?.priority || 'medium');
    const [categoryId, setCategoryId] = useState(task?.categoryId || categories[0]?.id || '');
    const [timeInputMode, setTimeInputMode] = useState<'endTime' | 'duration'>('endTime');
    const [duration, setDuration] = useState({ hours: 1, minutes: 0});

    useEffect(() => {
        if(task) {
            const start = dayjs(task.startTime);
            const end = dayjs(task.endTime);
            const diffMinutes = end.diff(start, 'minute');
            setDuration({ hours: Math.floor(diffMinutes / 60), minutes: diffMinutes % 60});
        }
    }, [task]);
    
    useEffect(() => {
        if (timeInputMode === 'duration') {
            const newEndTime = dayjs(startTime).add(duration.hours, 'hour').add(duration.minutes, 'minute');
            setEndTime(newEndTime.format('YYYY-MM-DDTHH:mm'));
        }
    }, [startTime, duration, timeInputMode]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!title || !categoryId) return;
        const finalEndTime = timeInputMode === 'duration'
            ? dayjs(startTime).add(duration.hours, 'hour').add(duration.minutes, 'minute').valueOf()
            : dayjs(endTime).valueOf();

        onSave({ id: task?.id || crypto.randomUUID(), title, description, startTime: dayjs(startTime).valueOf(), endTime: finalEndTime, priority, categoryId, status: task?.status || 'pending', order: task?.order || 0, createdAt: task?.createdAt || Date.now() });
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <motion.div initial={{opacity:0, scale: 0.9}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale: 0.9}} className="bg-[var(--bg-secondary)] p-6 rounded-2xl border border-[var(--border-color)] w-full max-w-lg shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" aria-label="Close modal"><X size={24}/></button>
                <h2 className="text-2xl font-bold mb-6 text-[var(--text-accent)]">{task ? 'Edit Task' : 'Add New Task'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label htmlFor="task-title" className="sr-only">Task Title</label><input id="task-title" type="text" placeholder="Task Title" value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-[var(--bg-card-solid)] p-3 rounded-lg border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--text-accent)]"/></div>
                    <div><label htmlFor="task-description" className="sr-only">Task Description</label><textarea id="task-description" placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-[var(--bg-card-solid)] p-3 rounded-lg border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--text-accent)] h-24"/></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label htmlFor="start-time" className="text-sm text-[var(--text-secondary)] mb-1 block">Start Time</label><input id="start-time" type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} required className="w-full bg-[var(--bg-card-solid)] p-2 rounded-lg border border-[var(--border-color)]"/></div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm text-[var(--text-secondary)]">Mode</label>
                                <button type="button" onClick={() => setTimeInputMode(m => m === 'endTime' ? 'duration' : 'endTime')} className="text-xs text-[var(--text-accent)] flex items-center gap-1"><ChevronsUpDown size={14}/> Switch</button>
                            </div>
                            {timeInputMode === 'endTime' ? (
                                <div><label htmlFor="end-time" className="sr-only">End Time</label><input id="end-time" type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} required className="w-full bg-[var(--bg-card-solid)] p-2 rounded-lg border border-[var(--border-color)]"/></div>
                            ) : (
                                <div className="flex gap-2">
                                    <div><label htmlFor="duration-hours" className="sr-only">Duration Hours</label><input id="duration-hours" type="number" value={duration.hours} onChange={e => setDuration(d => ({...d, hours: parseInt(e.target.value) || 0}))} className="w-1/2 bg-[var(--bg-card-solid)] p-2 rounded-lg border border-[var(--border-color)]" min="0"/></div>
                                    <div><label htmlFor="duration-minutes" className="sr-only">Duration Minutes</label><input id="duration-minutes" type="number" value={duration.minutes} onChange={e => setDuration(d => ({...d, minutes: parseInt(e.target.value) || 0}))} className="w-1/2 bg-[var(--bg-card-solid)] p-2 rounded-lg border border-[var(--border-color)]" min="0" max="59"/></div>
                                </div>
                            )}
                        </div>
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="text-sm text-[var(--text-secondary)] mb-1 block" htmlFor="priority-select">Priority</label><select id="priority-select" value={priority} onChange={e => setPriority(e.target.value as any)} className="w-full bg-[var(--bg-card-solid)] p-2.5 rounded-lg border border-[var(--border-color)]"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                         <div><label className="text-sm text-[var(--text-secondary)] mb-1 block" htmlFor="category-select">Category</label><select id="category-select" value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-[var(--bg-card-solid)] p-2.5 rounded-lg border border-[var(--border-color)]">{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    </div>
                    <button type="submit" className="w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white font-bold py-3 rounded-lg shadow-lg transition">Save Task</button>
                </form>
            </motion.div>
        </div>
    );
};

export const CategoryManager: React.FC<{categories: Category[], onCategoriesChange: (cats: Category[]) => void}> = ({categories, onCategoriesChange}) => {
    const [newCatName, setNewCatName] = useState('');
    const [newCatColor, setNewCatColor] = useState('#3b82f6');
    const handleAdd = () => { if (newCatName.trim()) { onCategoriesChange([...categories, {id: crypto.randomUUID(), name: newCatName.trim(), color: newCatColor}]); setNewCatName(''); } };
    const handleDelete = (id: string) => { onCategoriesChange(categories.filter(c => c.id !== id)); };

    return (
        <div className="space-y-4">
            {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between bg-[var(--bg-card)] p-3 rounded-lg">
                    <div className="flex items-center gap-3"><div className="w-5 h-5 rounded-full" style={{backgroundColor: cat.color}}></div><span>{cat.name}</span></div>
                    <button onClick={() => handleDelete(cat.id)} className="text-[var(--text-secondary)] hover:text-red-400" aria-label={`Delete category ${cat.name}`}><Trash2 size={16}/></button>
                </div>
            ))}
            <div className="flex gap-2 items-center mt-4">
                <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="bg-[var(--bg-secondary)] rounded-md border-[var(--border-color)] h-10 w-10 p-1" aria-label="New category color"/>
                <input type="text" placeholder="New category name" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="flex-grow bg-[var(--bg-secondary)] p-2 rounded-lg border border-[var(--border-color)]" />
                <button onClick={handleAdd} className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white p-2 rounded-lg" aria-label="Add new category"><Plus size={20}/></button>
            </div>
        </div>
    );
};

export const ThemePreview: React.FC = () => {
    return (
        <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-[var(--text-accent)]">Theme Preview</h3>
                <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)]"></div>
            </div>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">This is how the UI will look with the current settings.</p>
            <button className="w-full p-2 mt-4 rounded-md text-white font-semibold bg-[var(--accent-primary-hover)]">
                Sample Button
            </button>
        </div>
    )
}

export const GlassCard: React.FC<{children: React.ReactNode, className?: string}> = ({children, className}) => {
    return <div className={`bg-[var(--bg-card)] backdrop-blur-md p-6 rounded-2xl border border-[var(--border-color)] ${className}`}>{children}</div>
}

export const ActivityPieChart: React.FC<{history: CompletedTask[], categories: Category[]}> = ({ history, categories }) => {
    const data = useMemo(() => {
        const categoryTime = new Map<string, number>();
        history.forEach(task => { categoryTime.set(task.categoryId, (categoryTime.get(task.categoryId) || 0) + (task.endTime - task.startTime)); });
        return Array.from(categoryTime.entries()).map(([catId, time]) => ({ name: categories.find(c => c.id === catId)?.name || 'Unknown', value: time }));
    }, [history, categories]);
    if(data.length === 0) return <p className="text-center text-[var(--text-secondary)]">No data for chart yet.</p>;
    return (
        <div className="w-full h-80"><ResponsiveContainer><PieChart><Pie data={data} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="var(--accent-primary)" dataKey="value" label={({ name, percent }) => `${name} ${(Number(percent || 0) * 100).toFixed(0)}%`}>{data.map((entry, index) => <Cell key={`cell-${index}`} fill={darkenColor(categories.find(c=>c.name === entry.name)?.color, -index*0.1)} />)}</Pie><Tooltip contentStyle={{ backgroundColor: 'var(--bg-card-solid)', border: '1px solid var(--border-color)' }}/></PieChart></ResponsiveContainer></div>
    );
};
export const WeeklyBarChart: React.FC<{history: CompletedTask[]}> = ({history}) => {
     const data = useMemo(() => {
        const weekData: { [key: string]: { name: string, tasks: number } } = { 'Mon': { name: 'Mon', tasks: 0 },'Tue': { name: 'Tue', tasks: 0 },'Wed': { name: 'Wed', tasks: 0 },'Thu': { name: 'Thu', tasks: 0 },'Fri': { name: 'Fri', tasks: 0 },'Sat': { name: 'Sat', tasks: 0 },'Sun': { name: 'Sun', tasks: 0 }};
        const startOfWeek = dayjs().startOf('week');
        history.forEach(task => { if (dayjs(task.completedAt).isAfter(startOfWeek)) { const day = dayjs(task.completedAt).format('ddd'); if (weekData[day]) weekData[day].tasks++; } });
        return Object.values(weekData);
    }, [history]);
    return (<div className="w-full h-80"><ResponsiveContainer><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" /><XAxis dataKey="name" stroke="var(--text-secondary)" /><YAxis stroke="var(--text-secondary)" /><Tooltip contentStyle={{ backgroundColor: 'var(--bg-card-solid)', border: '1px solid var(--border-color)' }} /><Legend /><Bar dataKey="tasks" fill="var(--text-accent)" /></BarChart></ResponsiveContainer></div>);
};
export const MonthlyLineChart: React.FC<{history: CompletedTask[]}> = ({history}) => {
    const data = useMemo(() => {
        const monthData: { [key: number]: { name: string, progress: number } } = {};
        const startOfMonth = dayjs().startOf('month');
        history.forEach(task => { if (dayjs(task.completedAt).isAfter(startOfMonth)) { const day = dayjs(task.completedAt).date(); if(!monthData[day]) monthData[day] = { name: `Day ${day}`, progress: 0 }; monthData[day].progress++; } });
        return Object.values(monthData).sort((a,b) => parseInt(a.name.split(' ')[1]) - parseInt(b.name.split(' ')[1]));
    }, [history]);
    return (<div className="w-full h-80"><ResponsiveContainer><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)"/><XAxis dataKey="name" stroke="var(--text-secondary)" /><YAxis stroke="var(--text-secondary)"/><Tooltip contentStyle={{ backgroundColor: 'var(--bg-card-solid)', border: '1px solid var(--border-color)' }}/><Legend /><Line type="monotone" dataKey="progress" stroke="var(--text-accent)" strokeWidth={2} /></LineChart></ResponsiveContainer></div>);
}
export const AchievementBadge: React.FC<{achievement: Achievement}> = ({achievement}) => {
    return (<div className={`flex items-center p-4 rounded-lg border ${achievement.unlocked ? 'bg-amber-900/50 border-amber-500' : 'bg-[var(--bg-secondary)] border-[var(--border-color)] opacity-60'}`}><Trophy size={40} className={achievement.unlocked ? 'text-amber-400' : 'text-[var(--text-secondary)]'}/><div className="ml-4"><h4 className="font-bold">{achievement.title}</h4><p className="text-sm text-[var(--text-secondary)]">{achievement.description}</p></div></div>)
}

const DigitalClock: React.FC = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);
    return (
        <div className="text-center bg-[var(--bg-card-solid)] p-4 rounded-lg border border-[var(--border-color)]">
            <p className="text-4xl font-mono tracking-widest text-[var(--text-accent)]">{dayjs(time).format('h:mm:ss A')}</p>
        </div>
    );
};

export const SetupModal: React.FC<{ categories: Category[], onSetupComplete: (tasks: Task[]) => void }> = ({ categories, onSetupComplete }) => {
    const [mode, setMode] = useState<'clock' | 'duration'>('clock');
    const [tempTasks, setTempTasks] = useState<Task[]>([]);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

    // Duration Mode State
    const [sleepDuration, setSleepDuration] = useState(8);
    const [workDuration, setWorkDuration] = useState(8);
    const [durationTaskName, setDurationTaskName] = useState("");
    const [durationTaskMinutes, setDurationTaskMinutes] = useState(30);
    const [editingDurationTaskId, setEditingDurationTaskId] = useState<string | null>(null);
    const [previewedTasks, setPreviewedTasks] = useState<Task[] | null>(null);

    useEffect(() => {
        setPreviewedTasks(null); // Reset preview on mode change
        if (mode === 'clock') {
            setTempTasks(createDefaultTasks(categories));
        } else {
            setTempTasks([]);
        }
    }, [mode, categories]);

    const handleSaveTask = (task: Task) => {
        if (previewedTasks && previewedTasks.some(t => t.id === task.id)) {
            const overlaps = previewedTasks.some(existingTask => 
                existingTask.id !== task.id &&
                (
                    (task.startTime >= existingTask.startTime && task.startTime < existingTask.endTime) ||
                    (task.endTime > existingTask.startTime && task.endTime <= existingTask.endTime) ||
                    (task.startTime <= existingTask.startTime && task.endTime >= existingTask.endTime)
                )
            );

            if (overlaps) {
                alert("Task times overlap with an existing task in the preview. Please choose different times.");
                return;
            }
            setPreviewedTasks(previewedTasks.map(t => t.id === task.id ? task : t).sort((a,b) => a.startTime - b.startTime));
        } else {
            const existing = tempTasks.find(t => t.id === task.id);
            if (existing) {
                setTempTasks(tempTasks.map(t => t.id === task.id ? task : t));
            } else {
                setTempTasks([...tempTasks, { ...task, order: tempTasks.length }]);
            }
        }
        setIsTaskModalOpen(false);
        setEditingTask(null);
    };

    const handleDeleteTask = (id: string) => {
        setTempTasks(tempTasks.filter(t => t.id !== id));
    };

    const handleAddNewTask = () => { setEditingTask(null); setIsTaskModalOpen(true); };
    const handleEditTask = (task: Task) => { setEditingTask(task); setIsTaskModalOpen(true); };
    
    const handleAddOrUpdateDurationTask = () => {
        if (!durationTaskName.trim() || durationTaskMinutes <= 0) return;

        if (editingDurationTaskId) {
            setTempTasks(tempTasks.map(t => t.id === editingDurationTaskId ? { ...t, title: durationTaskName, endTime: durationTaskMinutes * 60 * 1000 } : t));
        } else {
            const newTask: Task = {
                id: crypto.randomUUID(), title: durationTaskName, description: 'Duration-based task',
                startTime: 0, endTime: durationTaskMinutes * 60 * 1000,
                status: 'pending', priority: 'medium',
                categoryId: categories.find(c => c.name.toLowerCase() === 'study')?.id || categories[0]?.id || 'study',
                order: tempTasks.length, createdAt: Date.now(),
            };
            setTempTasks([...tempTasks, newTask]);
        }
        
        setDurationTaskName('');
        setDurationTaskMinutes(30);
        setEditingDurationTaskId(null);
    };
    
    const scheduleDurationTasks = (): Task[] => {
        const today = dayjs().startOf('day');
        let scheduledTasks: Task[] = [];
        let freeSlots: { start: dayjs.Dayjs, end: dayjs.Dayjs }[] = [{ start: today, end: today.add(24, 'hour') }];

        const allocateTime = (durationMs: number, taskDetails: Omit<Task, 'startTime' | 'endTime'>) => {
             for (let i = 0; i < freeSlots.length; i++) {
                const slot = freeSlots[i];
                const slotDuration = slot.end.diff(slot.start, 'ms');
                if (slotDuration >= durationMs) {
                    const taskStartTime = slot.start;
                    const taskEndTime = taskStartTime.add(durationMs, 'ms');
                    scheduledTasks.push({ ...taskDetails, startTime: taskStartTime.valueOf(), endTime: taskEndTime.valueOf() });
                    const remainingSlotStart = taskEndTime;
                    if (remainingSlotStart.isBefore(slot.end)) {
                        freeSlots[i] = { start: remainingSlotStart, end: slot.end };
                    } else { freeSlots.splice(i, 1); }
                    return true;
                }
            }
            return false;
        };
        
        const fixedTasks = [
            { title: 'Sleeping Time', durationHours: sleepDuration, category: 'rest', priority: 'low' as const },
            { title: 'Work/School Time', durationHours: workDuration, category: 'work', priority: 'high' as const },
        ];
        
        fixedTasks.forEach(ft => {
            if (ft.durationHours <= 0) return;
            allocateTime(ft.durationHours * 60 * 60 * 1000, {
                id: crypto.randomUUID(), title: ft.title, status: 'pending', priority: ft.priority, 
                categoryId: categories.find(c => c.name.toLowerCase() === ft.category)?.id || categories[0].id, order: 0, createdAt: Date.now()
            });
        });

        const userDurationTasks = [...tempTasks].sort((a, b) => b.endTime - a.endTime);
        userDurationTasks.forEach(dt => allocateTime(dt.endTime, dt));

        return scheduledTasks.sort((a, b) => a.startTime - b.startTime).map((t, index) => ({...t, order: index}));
    };
    
    const handleSaveAndExit = () => {
        if (mode === 'duration') {
            onSetupComplete(previewedTasks || scheduleDurationTasks());
        } else {
            onSetupComplete(tempTasks.sort((a, b) => a.startTime - b.startTime));
        }
    };

    const renderClockMode = () => (
        <>
            <DigitalClock />
            <h4 className="text-lg font-semibold mt-6 mb-2 text-[var(--text-secondary)]">Default Schedule</h4>
            <p className="text-sm text-[var(--text-secondary)] mb-4">Here's a standard schedule to get you started. Feel free to edit, delete, or add tasks to fit your day.</p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {tempTasks.sort((a,b) => a.startTime - b.startTime).map(task => (
                    <div key={task.id} className="flex items-center justify-between bg-[var(--bg-card)] p-3 rounded-lg">
                        <div>
                            <p className="font-semibold">{task.title}</p>
                            <p className="text-xs text-[var(--text-accent)]">{dayjs(task.startTime).format('h:mm A')} - {dayjs(task.endTime).format('h:mm A')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleEditTask(task)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-accent)]" aria-label={`Edit ${task.title}`}><Edit2 size={16}/></button>
                            <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-[var(--text-secondary)] hover:text-red-400" aria-label={`Delete ${task.title}`}><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={handleAddNewTask} className="w-full mt-4 text-center py-2 border-2 border-dashed border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-accent)] transition">Add New Task</button>
        </>
    );

    const renderDurationMode = () => (
        <>
            <h4 className="text-lg font-semibold mb-2 text-[var(--text-secondary)]">Fixed Durations</h4>
            <p className="text-sm text-[var(--text-secondary)] mb-4">How many hours do you typically spend on these core activities? The app will schedule them first.</p>
            <div className="grid grid-cols-2 gap-4">
                <div><label htmlFor="sleep-duration" className="text-sm block mb-1">Sleeping Time (hours)</label><input id="sleep-duration" type="number" min="0" max="24" value={sleepDuration} onChange={e => setSleepDuration(parseInt(e.target.value) || 0)} className="w-full bg-[var(--bg-card-solid)] p-2 rounded-lg border border-[var(--border-color)]"/></div>
                <div><label htmlFor="work-duration" className="text-sm block mb-1">Work/School (hours)</label><input id="work-duration" type="number" min="0" max="24" value={workDuration} onChange={e => setWorkDuration(parseInt(e.target.value) || 0)} className="w-full bg-[var(--bg-card-solid)] p-2 rounded-lg border border-[var(--border-color)]"/></div>
            </div>
            <h4 className="text-lg font-semibold mt-6 mb-2 text-[var(--text-secondary)]">Your Tasks</h4>
            <p className="text-sm text-[var(--text-secondary)] mb-4">Add your other tasks for the day with their estimated duration. The app will fit them into your free time.</p>
            <div className="flex gap-2 mb-4">
                <input type="text" placeholder="Task Name (e.g., Study)" value={durationTaskName} onChange={e => setDurationTaskName(e.target.value)} className="flex-grow bg-[var(--bg-card-solid)] p-2 rounded-lg border border-[var(--border-color)]"/>
                <input type="number" min="1" value={durationTaskMinutes} onChange={e => setDurationTaskMinutes(parseInt(e.target.value) || 0)} className="w-24 bg-[var(--bg-card-solid)] p-2 rounded-lg border border-[var(--border-color)]" aria-label="Task duration in minutes"/>
                <span className="flex items-center text-sm text-[var(--text-secondary)]">min</span>
                <button onClick={handleAddOrUpdateDurationTask} className="bg-[var(--accent-primary)] text-white p-2 rounded-lg" aria-label="Add or update duration task">
                    {editingDurationTaskId ? <CheckCircle size={20} /> : <Plus size={20}/>}
                </button>
            </div>
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                {tempTasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between bg-[var(--bg-card)] p-2 rounded-lg">
                        <p>{task.title} - <strong>{task.endTime / 60000} min</strong></p>
                        <div className="flex items-center gap-2">
                             <button onClick={() => { setEditingDurationTaskId(task.id); setDurationTaskName(task.title); setDurationTaskMinutes(task.endTime / 60000); }} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-accent)]" aria-label={`Edit ${task.title}`}><Edit2 size={16}/></button>
                             <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-[var(--text-secondary)] hover:text-red-400" aria-label={`Delete ${task.title}`}><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}
            </div>
            {previewedTasks ? (
                 <div className="mt-6">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-lg font-semibold text-[var(--text-secondary)]">Previewed Schedule</h4>
                        <button onClick={() => setPreviewedTasks(null)} className="text-sm text-[var(--text-accent)]">Go Back</button>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 bg-[var(--bg-card)] p-3 rounded-lg">
                         {previewedTasks.map(task => (
                            <div key={task.id} className="flex justify-between items-center">
                                <p><strong>{dayjs(task.startTime).format('h:mm A')}</strong> - {task.title}</p>
                                <button onClick={() => handleEditTask(task)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-accent)]" aria-label={`Edit ${task.title}`}><Edit2 size={16}/></button>
                            </div>
                         ))}
                    </div>
                 </div>
            ) : (
                <button onClick={() => setPreviewedTasks(scheduleDurationTasks())} className="w-full mt-4 text-center py-2 bg-[var(--bg-secondary)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--border-color)] transition disabled:opacity-50" disabled={tempTasks.length === 0}>Preview Schedule</button>
            )}
        </>
    );

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div initial={{opacity:0, scale: 0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale: 0.95}} className="bg-[var(--bg-secondary)] p-6 rounded-2xl border border-[var(--border-color)] w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <h2 className="text-2xl font-bold mb-2 text-center text-[var(--text-accent)]">Plan Your Day</h2>
                <p className="text-center text-[var(--text-secondary)] mb-6">Choose how you'd like to set up your schedule.</p>
                <div className="flex justify-center p-1 rounded-lg bg-[var(--bg-card-solid)] mb-6">
                    <button onClick={() => setMode('clock')} className={`px-6 py-2 rounded-md font-semibold transition ${mode === 'clock' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}>Clock Time Mode</button>
                    <button onClick={() => setMode('duration')} className={`px-6 py-2 rounded-md font-semibold transition ${mode === 'duration' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}>Duration Mode</button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2">
                    <AnimatePresence mode="wait">
                        <motion.div key={mode} initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} exit={{opacity:0, y: -10}}>
                            {mode === 'clock' ? renderClockMode() : renderDurationMode()}
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--border-color)]">
                    <button onClick={handleSaveAndExit} className="w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white font-bold py-3 rounded-lg shadow-lg transition">Save & Start Day</button>
                </div>
            </motion.div>
            <AnimatePresence>
                {isTaskModalOpen && <TaskModal task={editingTask} categories={categories} onSave={handleSaveTask} onClose={() => setIsTaskModalOpen(false)} />}
            </AnimatePresence>
        </div>
    );
};

export const DashboardHeader: React.FC<{user: User, tasks: Task[]}> = ({user, tasks}) => {
    const [greeting, setGreeting] = useState('');
    
    useEffect(() => {
        const hour = dayjs().hour();
        if (hour < 12) setGreeting('Good morning');
        else if (hour < 18) setGreeting('Good afternoon');
        else setGreeting('Good evening');
    }, []);

    const todaysTasks = tasks.filter(t => dayjs(t.startTime).isSame(dayjs(), 'day'));
    const completedTasks = todaysTasks.filter(t => t.status === 'completed').length;
    const progress = todaysTasks.length > 0 ? (completedTasks / todaysTasks.length) * 100 : 0;

    return (
        <GlassCard className="mb-6">
            <h2 className="text-2xl font-bold">{greeting}, {user.name}!</h2>
            <p className="text-[var(--text-secondary)] mt-2">You have {todaysTasks.length - completedTasks} tasks left for today.</p>
            <div className="mt-4">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-[var(--text-accent)]">Today's Progress</span>
                    <span className="text-sm font-semibold text-[var(--text-accent)]">{completedTasks}/{todaysTasks.length}</span>
                </div>
                <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2.5">
                    <div className="bg-[var(--accent-primary)] h-2.5 rounded-full transition-all duration-500" style={{width: `${progress}%`}}></div>
                </div>
            </div>
        </GlassCard>
    );
};

export const PdfExportContent: React.FC<{ user: User | null; tasks: Task[]; history: CompletedTask[]; categories: Category[] }> = ({ user, tasks, history, categories }) => {
    const styles = {
        container: { fontFamily: 'sans-serif', padding: '20px', color: '#000', backgroundColor: '#fff', width: '794px' }, // A4 width in pixels
        h1: { fontSize: '24px', marginBottom: '20px', color: '#1e293b' },
        h2: { fontSize: '18px', marginTop: '30px', marginBottom: '10px', borderBottom: '1px solid #cbd5e1', paddingBottom: '5px', color: '#475569' },
        header: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '12px' },
        taskTable: { width: '100%', borderCollapse: 'collapse' as const },
        th: { border: '1px solid #ddd', padding: '8px', textAlign: 'left' as const, backgroundColor: '#f2f2f2' },
        td: { border: '1px solid #ddd', padding: '8px' },
    };

    const todaysTasks = tasks.filter(task => dayjs(task.startTime).isSame(dayjs(), 'day')).sort((a, b) => a.startTime - b.startTime);
    const startOfWeek = dayjs().startOf('week');
    const thisWeeksHistory = history.filter(task => dayjs(task.completedAt).isAfter(startOfWeek)).sort((a,b) => a.completedAt - b.completedAt);
    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'N/A';
    
    return (
        <div id="pdf-export-content" style={{ ...styles.container, position: 'absolute', left: '-9999px', top: 0 }}>
            <h1 style={styles.h1}>Zenith Report</h1>
            <div style={styles.header}>
                <p><strong>User:</strong> {user?.name}</p>
                <p><strong>Date:</strong> {dayjs().format('YYYY-MM-DD')}</p>
            </div>
            
            <h2 style={styles.h2}>Today's Schedule</h2>
            {todaysTasks.length > 0 ? (
                <table style={styles.taskTable}>
                    <thead><tr><th style={styles.th}>Time</th><th style={styles.th}>Task</th><th style={styles.th}>Category</th><th style={styles.th}>Priority</th></tr></thead>
                    <tbody>{todaysTasks.map(task => (<tr key={task.id}><td style={styles.td}>{dayjs(task.startTime).format('h:mm A')} - {dayjs(task.endTime).format('h:mm A')}</td><td style={styles.td}>{task.title}</td><td style={styles.td}>{getCategoryName(task.categoryId)}</td><td style={styles.td}>{task.priority}</td></tr>))}</tbody>
                </table>
            ) : <p>No tasks scheduled for today.</p>}
            
            <h2 style={styles.h2}>This Week's Completed Tasks ({thisWeeksHistory.length})</h2>
            {thisWeeksHistory.length > 0 ? (
                 <table style={styles.taskTable}>
                    <thead><tr><th style={styles.th}>Completed At</th><th style={styles.th}>Task</th><th style={styles.th}>Category</th></tr></thead>
                    <tbody>{thisWeeksHistory.map(task => (<tr key={task.id}><td style={styles.td}>{dayjs(task.completedAt).format('ddd, h:mm A')}</td><td style={styles.td}>{task.title}</td><td style={styles.td}>{getCategoryName(task.categoryId)}</td></tr>))}</tbody>
                </table>
            ) : <p>No tasks completed this week yet.</p>}
        </div>
    );
};