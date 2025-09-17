import React, { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { User, Task, CompletedTask, Page, Theme, Font, Settings, Achievement, Category, FontSize } from './types.ts';
import { dbService, notificationService, dataService } from './services.ts';
import { Navbar, TaskManager, Timeline, GlassCard, ActivityPieChart, WeeklyBarChart, MonthlyLineChart, AchievementBadge, CategoryManager, ThemePreview, SetupModal, DashboardHeader, PdfExportContent } from './components.tsx';
import dayjs from 'dayjs';
import { List, LayoutGrid, CheckCircle, Info, Download, Upload, FileText } from 'lucide-react';

// FIX: Add global declarations for jspdf and html2canvas to resolve compilation errors.
declare const jspdf: any;
declare const html2canvas: any;

type ToastMessage = { id: string; message: string; type: 'success' | 'error' | 'info' };
type ToastContextType = { showToast: (message: string, type?: ToastMessage['type']) => void; };

// --- CONTEXTS ---
const AuthContext = createContext<{ user: User | null; login: (email: string, pass: string) => Promise<boolean>; signup: (name: string, email: string, pass: string) => Promise<boolean>; logout: () => void; updateUser: (user: Partial<User>) => Promise<void>; } | null>(null);
export const useAuth = () => useContext(AuthContext)!;

const DataContext = createContext<{ tasks: Task[]; categories: Category[]; history: CompletedTask[]; achievements: Achievement[]; loading: boolean; setTasks: (tasks: Task[]) => void; saveTask: (task: Task) => void; addCompletedTask: (task: Task) => void; setCategories: (categories: Category[]) => void; } | null>(null);
export const useData = () => useContext(DataContext)!;

const SettingsContext = createContext<{ settings: Settings; setTheme: (theme: Theme) => void; setFont: (font: Font) => void; setLanguage: (lang: 'en' | 'ur') => void; setFontSize: (fontSize: FontSize) => void; } | null>(null);
export const useSettings = () => useContext(SettingsContext)!;

const ToastContext = createContext<ToastContextType | null>(null);
export const useToast = () => useContext(ToastContext)!;

// --- PROVIDERS ---
const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkUser = async () => {
            const currentUser = await dbService.getCurrentUser();
            if (currentUser && currentUser.id) {
                const fullUser = await dbService.getUser(currentUser.id);
                setUser(fullUser || null);
            }
            setLoading(false);
        };
        checkUser();
    }, []);

    const login = async (email: string, password: string): Promise<boolean> => {
        const foundUser = await dbService.getUserByEmail(email);
        if (foundUser && foundUser.password === password) { await dbService.setCurrentUser(foundUser); setUser(foundUser); return true; }
        return false;
    };
    
    const signup = async (name: string, email: string, password: string): Promise<boolean> => {
        if (await dbService.getUserByEmail(email)) return false;
        const newUser: User = { name, email, password };
        const id = await dbService.addUser(newUser);
        const userWithId = { ...newUser, id };
        await dbService.setCurrentUser(userWithId);
        setUser(userWithId);
        return true;
    };

    const logout = async () => { await dbService.clearCurrentUser(); setUser(null); };

    const updateUser = async (updatedFields: Partial<User>) => {
        if(user && user.id) {
            const fullUser = await dbService.getUser(user.id);
            if(fullUser) {
                const updatedUser = {...fullUser, ...updatedFields};
                await dbService.updateUser(updatedUser);
                await dbService.setCurrentUser(updatedUser);
                setUser(updatedUser);
            }
        }
    };

    if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading Zenith...</div>;

    return <AuthContext.Provider value={{ user, login, signup, logout, updateUser }}>{children}</AuthContext.Provider>;
};

const DataProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [history, setHistory] = useState<CompletedTask[]>([]);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [loading, setLoading] = useState(true);
    
    const initialAchievements: Achievement[] = [ { id: 'streak-7', title: 'Week-long Warrior', description: 'Complete tasks for 7 days in a row.', unlocked: false, icon: 'trophy' }, { id: 'early-riser', title: 'Early Riser', description: 'Complete a task before 8 AM.', unlocked: false, icon: 'sunrise' }];
    const defaultCategories: Category[] = [ { id: 'work', name: 'Work', color: '#ef4444' }, { id: 'study', name: 'Study', color: '#3b82f6' }, { id: 'exercise', name: 'Exercise', color: '#22c55e' }, { id: 'gaming', name: 'Gaming', color: '#8b5cf6' }, { id: 'rest', name: 'Rest', color: '#64748b' }];

    useEffect(() => {
        const loadData = async () => {
            if (user) {
                setLoading(true);
                const [dbTasks, dbHistory, dbAchievements, dbCategories] = await Promise.all([ dbService.getTasks(), dbService.getHistory(), dbService.getAchievements(), dbService.getCategories() ]);
                
                let currentCategories = dbCategories;
                if (dbCategories.length === 0) {
                    await dbService.saveCategories(defaultCategories);
                    currentCategories = defaultCategories;
                }
                setCategories(currentCategories);

                setTasks(dbTasks);
                dbTasks.forEach(task => notificationService.scheduleTaskNotifications(task));
                
                const todaysTasks = dbTasks.filter(t => dayjs(t.startTime).isSame(dayjs(), 'day'));
                const completedToday = todaysTasks.filter(t => t.status === 'completed').length;
                notificationService.scheduleDailySummary(completedToday, todaysTasks.length);

                setHistory(dbHistory);
                
                if(dbAchievements.length === 0) { await dbService.saveAchievements(initialAchievements); setAchievements(initialAchievements); } else { setAchievements(dbAchievements); }
                
                setLoading(false);
            }
        };
        loadData();
    }, [user]);

    const handleSetTasks = async (newTasks: Task[]) => { setTasks(newTasks); await dbService.saveTasks(newTasks); };
    const handleSaveTask = async (taskToSave: Task) => { const newTasks = tasks.find(t => t.id === taskToSave.id) ? tasks.map(t => t.id === taskToSave.id ? taskToSave : t) : [...tasks, taskToSave]; setTasks(newTasks); await dbService.saveTasks(newTasks); notificationService.scheduleTaskNotifications(taskToSave); };
    const addCompletedTask = async (task: Task) => {
        if (history.some(h => h.id === task.id)) return;
        const completedTask: CompletedTask = { ...task, status: 'completed', completedAt: Date.now() };
        setHistory(prev => [...prev, completedTask]);
        await dbService.addToHistory(completedTask);
        
        const updatedAchievements = [...achievements];
        const earlyRiser = updatedAchievements.find(a => a.id === 'early-riser');
        if(earlyRiser && !earlyRiser.unlocked && dayjs().hour() < 8){
            earlyRiser.unlocked = true;
            await dbService.saveAchievements(updatedAchievements);
            setAchievements(updatedAchievements);
        }
    };
    const handleSetCategories = async (newCategories: Category[]) => { setCategories(newCategories); await dbService.saveCategories(newCategories); };
    
    return <DataContext.Provider value={{tasks, categories, history, achievements, loading, setTasks: handleSetTasks, saveTask: handleSaveTask, addCompletedTask, setCategories: handleSetCategories }}>{children}</DataContext.Provider>
}

const SettingsProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
    const { user } = useAuth();
    const { i18n } = useTranslation();
    const [settings, setSettings] = useState<Settings>({ theme: 'dark', font: 'sans', language: 'en', fontSize: 'base' });

    useEffect(() => {
        const loadSettings = async () => {
            if(user?.id) {
                const savedSettings = await dbService.getSettings(user.id);
                if(savedSettings) { setSettings(savedSettings); applySettings(savedSettings); } else { applySettings(settings); }
            }
        };
        loadSettings();
    }, [user]);
    
    const applySettings = (s: Settings) => {
        const body = document.body;
        body.className = '';
        body.classList.add(`theme-${s.theme}`, `font-${s.font}`, `font-size-${s.fontSize}`);
        i18n.changeLanguage(s.language);
    };

    const updateAndSaveSettings = (newSettings: Partial<Settings>) => {
        if(user?.id) {
            const updatedSettings = { ...settings, ...newSettings };
            setSettings(updatedSettings);
            applySettings(updatedSettings);
            dbService.saveSettings({ ...updatedSettings, userId: user.id });
        }
    };
    
    return <SettingsContext.Provider value={{ settings, setTheme: (theme) => updateAndSaveSettings({ theme }), setFont: (font) => updateAndSaveSettings({ font }), setLanguage: (language) => updateAndSaveSettings({ language }), setFontSize: (fontSize) => updateAndSaveSettings({ fontSize }) }}>{children}</SettingsContext.Provider>;
};

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = (message: string, type: ToastMessage['type'] = 'info') => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(currentToasts => currentToasts.filter(t => t.id !== id));
        }, 3000);
    };

    const ToastContainer = () => (
        <div className="fixed bottom-5 right-5 z-[200] space-y-2">
            <AnimatePresence>
                {toasts.map(toast => (
                    <motion.div
                        key={toast.id}
                        layout
                        initial={{ opacity: 0, y: 50, scale: 0.3 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                        className={`flex items-center gap-3 p-4 rounded-lg shadow-lg text-white ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-sky-600'}`}
                    >
                       {toast.type === 'success' && <CheckCircle />} {toast.type === 'info' && <Info />}
                       {toast.message}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <ToastContainer />
        </ToastContext.Provider>
    );
};

// --- PAGES ---

const AuthPage: React.FC = () => {
    const { login, signup } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (isLogin) { if (!await login(email, password)) setError('Invalid email or password.'); } 
        else { if (password !== confirmPassword) { setError('Passwords do not match.'); return; } if (!await signup(name, email, password)) setError('Email already in use.'); }
    };
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
             <motion.div initial={{opacity:0, y: -20}} animate={{opacity:1, y:0}} className="w-full max-w-md">
                <GlassCard>
                    <h2 className="text-3xl font-bold text-center mb-6 text-[var(--text-accent)]">{isLogin ? 'Login' : 'Sign Up'}</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--text-accent)]"/>}
                        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--text-accent)]"/>
                        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--text-accent)]"/>
                        {!isLogin && <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--text-accent)]"/>}
                        {error && <p className="text-red-400 text-sm">{error}</p>}
                        <button type="submit" className="w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white font-bold py-3 rounded-lg shadow-lg transition">{isLogin ? 'Login' : 'Sign Up'}</button>
                    </form>
                    <p className="text-center mt-4"><button onClick={() => setIsLogin(!isLogin)} className="text-[var(--text-accent)] hover:underline">{isLogin ? "Need an account? Sign Up" : "Already have an account? Login"}</button></p>
                </GlassCard>
            </motion.div>
        </div>
    );
};

const DashboardPage: React.FC = () => {
    const { user } = useAuth();
    const { tasks, categories, setTasks, saveTask, addCompletedTask } = useData();
    const { showToast } = useToast();
    const [view, setView] = useState<'list' | 'timeline'>('list');
    const [currentTaskId, setCurrentTaskId] = useState<string|null>(null);

    useEffect(() => {
        const findCurrentTask = () => {
            const now = Date.now();
            const current = tasks.find(t => now >= t.startTime && now <= t.endTime && t.status !== 'completed');
            setCurrentTaskId(current ? current.id : null);
        };
        findCurrentTask();
        const interval = setInterval(findCurrentTask, 1000 * 30);
        return () => clearInterval(interval);
    }, [tasks]);
    
    const handleSaveTaskWithToast = (task: Task) => {
        saveTask(task);
        showToast('Task saved successfully!', 'success');
    };

    return (
        <div className="h-full flex flex-col">
             {user && <DashboardHeader user={user} tasks={tasks} />}
            <div className="flex justify-end mb-4">
                 <div className="bg-[var(--bg-secondary)] p-1 rounded-lg flex items-center gap-1">
                    <button onClick={() => setView('list')} className={`px-3 py-1 text-sm rounded-md flex items-center gap-2 ${view === 'list' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}><List size={16}/> List</button>
                    <button onClick={() => setView('timeline')} className={`px-3 py-1 text-sm rounded-md flex items-center gap-2 ${view === 'timeline' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}><LayoutGrid size={16}/> Timeline</button>
                 </div>
            </div>
            <div className="flex-grow min-h-0">
            {view === 'list' ? ( <TaskManager tasks={tasks} categories={categories} onTasksChange={setTasks} onTaskComplete={addCompletedTask} onTaskSave={handleSaveTaskWithToast} currentTaskId={currentTaskId}/> ) : ( <Timeline tasks={tasks} categories={categories} currentTaskId={currentTaskId}/> )}
            </div>
        </div>
    )
};

const HistoryPage: React.FC = () => {
    const { history } = useData();
    const { t } = useTranslation();
    const [filter, setFilter] = useState<'day' | 'week' | 'month'>('day');
    const filteredHistory = React.useMemo(() => {
        const now = dayjs();
        return [...history].filter(task => {
                const completedDate = dayjs(task.completedAt);
                if (filter === 'day') return completedDate.isSame(now, 'day');
                if (filter === 'week') return completedDate.isSame(now, 'week');
                if (filter === 'month') return completedDate.isSame(now, 'month');
                return true;
            }).sort((a, b) => b.completedAt - a.completedAt);
    }, [history, filter]);
    return (
        <GlassCard>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-[var(--text-accent)]">{t('history')}</h2>
                <div className="bg-[var(--bg-secondary)] p-1 rounded-lg flex items-center gap-1">
                    <button onClick={() => setFilter('day')} className={`px-3 py-1 text-sm rounded-md ${filter === 'day' ? 'bg-[var(--accent-primary)] text-white' : ''}`}>Day</button>
                    <button onClick={() => setFilter('week')} className={`px-3 py-1 text-sm rounded-md ${filter === 'week' ? 'bg-[var(--accent-primary)] text-white' : ''}`}>Week</button>
                    <button onClick={() => setFilter('month')} className={`px-3 py-1 text-sm rounded-md ${filter === 'month' ? 'bg-[var(--accent-primary)] text-white' : ''}`}>Month</button>
                </div>
            </div>
            <ul className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
                {filteredHistory.length > 0 ? filteredHistory.map(task => ( <li key={task.id} className="bg-[var(--bg-card)] p-3 rounded-lg flex justify-between"><span>{task.title}</span><span className="text-sm text-[var(--text-secondary)]">{dayjs(task.completedAt).format('YYYY-MM-DD HH:mm')}</span></li> )) : <p className="text-center mt-8 text-[var(--text-secondary)]">No completed tasks for this period.</p>}
            </ul>
        </GlassCard>
    )
};

const StatsPage: React.FC = () => {
    const { history, categories } = useData();
    return (
        <div className="space-y-8"><GlassCard><h3 className="text-xl font-bold mb-4 text-[var(--text-accent)]">Activity Distribution</h3><ActivityPieChart history={history} categories={categories} /></GlassCard><GlassCard><h3 className="text-xl font-bold mb-4 text-[var(--text-accent)]">Weekly Task Completion</h3><WeeklyBarChart history={history} /></GlassCard><GlassCard><h3 className="text-xl font-bold mb-4 text-[var(--text-accent)]">Monthly Progress</h3><MonthlyLineChart history={history} /></GlassCard></div>
    )
};

const SettingsPage: React.FC = () => {
    const { user, updateUser, logout } = useAuth();
    const { achievements, categories, setCategories, tasks, history } = useData();
    const { settings, setTheme, setFontSize, setLanguage } = useSettings();
    const { showToast } = useToast();
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const importFileInput = React.useRef<HTMLInputElement>(null);

    const THEMES: Theme[] = ['dark', 'light', 'gradient', 'colorful', 'elegant', 'minimal', 'high-contrast'];
    const FONT_SIZES: FontSize[] = ['sm', 'base', 'lg'];
    
    const handleProfileSave = () => {
        updateUser({ name, email });
        showToast('Profile updated successfully!', 'success');
    }

    const handleExport = async () => {
        try {
            const jsonData = await dataService.exportData();
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `zenith_backup_${dayjs().format('YYYY-MM-DD')}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Data exported successfully!');
        } catch (error) {
            showToast('Failed to export data.', 'error');
            console.error(error);
        }
    };
    
    const handleImportClick = () => {
        importFileInput.current?.click();
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!window.confirm("Are you sure? Importing will overwrite all current data.")) {
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = e.target?.result as string;
                await dataService.importData(json);
                showToast('Data imported successfully! App will now reload.', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } catch (error) {
                showToast('Failed to import data. Invalid file format.', 'error');
                console.error(error);
            }
        };
        reader.readAsText(file);
    };

    const handlePdfExport = async () => {
        const { jsPDF } = jspdf;
        const input = document.getElementById('pdf-export-content');
        if (!input) {
            showToast('Error finding content for PDF export.', 'error');
            return;
        }

        showToast('Generating PDF...', 'info');

        try {
            const canvas = await html2canvas(input, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            
            const ratio = Math.min(pdfWidth / canvasWidth, pdfHeight / canvasHeight);
            
            const imgWidth = canvasWidth * ratio;
            const imgHeight = canvasHeight * ratio;

            const x = (pdfWidth - imgWidth) / 2;
            const y = 0;

            pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
            pdf.save(`zenith-report-${dayjs().format('YYYY-MM-DD')}.pdf`);
            showToast('PDF exported successfully!', 'success');
        } catch (err) {
            console.error("Failed to generate PDF", err);
            showToast('Failed to generate PDF.', 'error');
        }
    };


    return (
         <div className="space-y-8">
            <GlassCard><h2 className="text-2xl font-bold mb-4 text-[var(--text-accent)]">Profile</h2><div className="flex items-center space-x-4 mb-6"><img src={`https://api.dicebear.com/8.x/initials/svg?seed=${user?.name}`} alt="Profile" className="w-24 h-24 rounded-full border-4 border-[var(--accent-primary)] bg-[var(--bg-secondary)]"/><div className="space-y-2"><input type="text" value={name} onChange={e => setName(e.target.value)} className="text-2xl font-bold bg-transparent border-b-2 border-transparent focus:border-[var(--text-accent)] focus:outline-none w-full"/><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="text-[var(--text-secondary)] bg-transparent border-b-2 border-transparent focus:border-[var(--text-accent)] focus:outline-none w-full"/></div></div><button onClick={handleProfileSave} className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white font-bold py-2 px-4 rounded-lg">Save Profile</button></GlassCard>
            
            <GlassCard><h3 className="text-xl font-bold mb-4 text-[var(--text-accent)]">Appearance</h3><div className="space-y-6"><ThemePreview /><div><label className="block mb-2 text-lg font-semibold">Theme</label><div className="grid grid-cols-3 md:grid-cols-4 gap-2">{THEMES.map(t => (<button key={t} onClick={() => setTheme(t)} className={`capitalize h-12 rounded-lg theme-${t} border-2 ${settings.theme === t ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-primary)] ring-[var(--text-accent)] border-transparent' : 'border-[var(--border-color)]'}`} style={{backgroundColor: 'var(--bg-secondary)'}}>{t}</button>))}</div></div><div><label className="block mb-2 text-lg font-semibold">Font Size</label><div className="flex gap-2">{FONT_SIZES.map(s => <button key={s} onClick={() => setFontSize(s)} className={`px-4 py-2 rounded-lg capitalize ${settings.fontSize === s ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-secondary)]'}`}>{s}</button>)}</div></div><div><label className="block mb-2 text-lg font-semibold">Language</label><select value={settings.language} onChange={e => setLanguage(e.target.value as 'en'|'ur')} className="w-full bg-[var(--bg-secondary)] p-2 rounded-lg border border-[var(--border-color)]"><option value="en">English</option><option value="ur">Urdu</option></select></div></div></GlassCard>
            
            <GlassCard><h3 className="text-xl font-bold mb-4 text-[var(--text-accent)]">Data Management</h3><div className="flex flex-col sm:flex-row gap-4"><button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-lg"><Download size={20} /> Export Data</button><button onClick={handleImportClick} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg"><Upload size={20} /> Import Data</button><button onClick={handlePdfExport} className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded-lg"><FileText size={20}/> Export PDF Report</button><input type="file" ref={importFileInput} onChange={handleImport} className="hidden" accept=".json"/></div></GlassCard>

            <GlassCard><h3 className="text-xl font-bold mb-4 text-[var(--text-accent)]">Manage Categories</h3><CategoryManager categories={categories} onCategoriesChange={setCategories}/></GlassCard>
            <GlassCard><h3 className="text-xl font-bold mb-4 text-[var(--text-accent)]">Achievements</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{achievements.map(ach => <AchievementBadge key={ach.id} achievement={ach}/>)}</div></GlassCard>
            
            <button onClick={logout} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg shadow-lg transition">Logout</button>
            <PdfExportContent user={user} tasks={tasks} history={history} categories={categories} />
        </div>
    );
};

const AboutPage: React.FC = () => (
    <GlassCard>
        <h2 className="text-2xl font-bold text-[var(--text-accent)] mb-4">About Zenith</h2>
        <div className="space-y-4 text-[var(--text-secondary)]">
            <p>Zenith is a modern, offline-first Progressive Web App (PWA) designed to help you manage your daily tasks and build productive routines.</p>
            <p><strong>Key Features:</strong></p>
            <ul className="list-disc list-inside space-y-2">
                <li><strong>Offline Functionality:</strong> Works completely offline. All your data is stored securely in your browser.</li>
                <li><strong>Timeline View:</strong> Visualize your day with a 24-hour timeline schedule.</li>
                <li><strong>Task Management:</strong> Create, edit, delete, and reorder tasks with a simple drag-and-drop interface.</li>
                <li><strong>Customization:</strong> Personalize the app with multiple color themes and font sizes.</li>
                <li><strong>Local Notifications:</strong> Get timely reminders for your upcoming tasks.</li>
                <li><strong>Data Portability:</strong> Backup and restore your data anytime using the Export/Import feature.</li>
            </ul>
            <p className="mt-6 text-sm">Version 1.1.0 - Crafted with care by Qasim Sajjad & Rehan Faryad.</p>
        </div>
    </GlassCard>
);

const PageRenderer: React.FC<{ page: Page }> = ({ page }) => {
    switch (page) {
        case 'dashboard': return <DashboardPage />;
        case 'history': return <HistoryPage />;
        case 'stats': return <StatsPage />;
        case 'settings': return <SettingsPage />;
        case 'about': return <AboutPage />;
        default: return <DashboardPage />;
    }
};

const AppContent: React.FC = () => {
    const { user } = useAuth();
    const { tasks, categories, setTasks, loading } = useData();
    const [page, setPage] = useState<Page>('dashboard');
    const [showSetupModal, setShowSetupModal] = useState(false);

    useEffect(() => {
        notificationService.requestPermission();
    }, []);

    useEffect(() => {
        if (user && !loading) {
            const todayStart = dayjs().startOf('day').valueOf();
            const todayEnd = dayjs().endOf('day').valueOf();
            const todaysTasks = tasks.filter(t => t.startTime >= todayStart && t.startTime <= todayEnd);
            if (todaysTasks.length === 0) {
                setShowSetupModal(true);
            }
        }
    }, [user, loading, tasks]);

    const handleSetupComplete = (newTasks: Task[]) => {
        setTasks(newTasks);
        newTasks.forEach(t => notificationService.scheduleTaskNotifications(t));
        setShowSetupModal(false);
    };

    if (!user) return <AuthPage />;
    if (loading) return <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center text-[var(--text-primary)]">Loading data...</div>;
    return (
        <div className="h-screen flex flex-col bg-[var(--bg-primary)]">
            <AnimatePresence>
                {showSetupModal && <SetupModal categories={categories} onSetupComplete={handleSetupComplete} />}
            </AnimatePresence>
            <Navbar activePage={page} setActivePage={setPage} />
            <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8 min-h-0 overflow-y-auto">
                 <AnimatePresence mode="wait">
                    <motion.div key={page} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="h-full">
                        <PageRenderer page={page} />
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
};

function App() {
    return ( <AuthProvider><SettingsProvider><DataProvider><ToastProvider><AppContent /></ToastProvider></DataProvider></SettingsProvider></AuthProvider> );
}
export default App;