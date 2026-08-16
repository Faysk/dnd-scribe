using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace DnDScribe.CompanionTray
{
    internal sealed class CompanionState
    {
        public bool Online;
        public bool Processing;
        public int Percent;
        public string Detail;
        public string ServiceVersion;
    }

    internal sealed class AboutForm : Form
    {
        public AboutForm(string controllerVersion, string serviceVersion, string versionDir, string dataRoot, string pythonPath)
        {
            Text = "Sobre o DnD Scribe Companion";
            ClientSize = new Size(680, 470);
            MinimumSize = new Size(620, 440);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(11, 14, 18);
            ForeColor = Color.FromArgb(242, 237, 226);
            Font = new Font("Segoe UI", 10F);

            Controls.Add(LabelAt("DND SCRIBE · WINDOWS", 32, 26, 600, 20, 9F, FontStyle.Bold, Color.FromArgb(220, 172, 89)));
            Controls.Add(LabelAt("Companion local", 30, 54, 610, 48, 25F, FontStyle.Bold, ForeColor));
            Controls.Add(LabelAt("Controlador " + controllerVersion + "  ·  Serviço " + serviceVersion, 32, 108, 610, 26, 10F, FontStyle.Regular, Color.FromArgb(174, 183, 196)));
            Controls.Add(LabelAt("O áudio, os modelos e as transcrições permanecem neste computador.", 32, 138, 610, 28, 10F, FontStyle.Regular, Color.FromArgb(174, 183, 196)));

            AddPath("APLICATIVO INSTALADO", versionDir, 184);
            AddPath("DADOS, ZIPS E ÁUDIOS", dataRoot, 252);
            AddPath("PYTHON ISOLADO", pythonPath, 320);

            Button openData = new Button();
            openData.Text = "Abrir pasta de dados";
            openData.SetBounds(32, 402, 178, 40);
            StyleButton(openData, true);
            openData.Click += delegate { Process.Start(new ProcessStartInfo { FileName = dataRoot, UseShellExecute = true }); };
            Controls.Add(openData);

            Button close = new Button();
            close.Text = "Fechar";
            close.SetBounds(540, 402, 108, 40);
            close.DialogResult = DialogResult.OK;
            StyleButton(close, false);
            Controls.Add(close);
            AcceptButton = close;
            CancelButton = close;
        }

        private void AddPath(string heading, string value, int y)
        {
            Controls.Add(LabelAt(heading, 32, y, 610, 18, 8F, FontStyle.Bold, Color.FromArgb(220, 172, 89)));
            TextBox field = new TextBox();
            field.Text = value;
            field.ReadOnly = true;
            field.SetBounds(32, y + 24, 616, 30);
            field.BackColor = Color.FromArgb(20, 25, 32);
            field.ForeColor = Color.FromArgb(194, 204, 217);
            field.BorderStyle = BorderStyle.FixedSingle;
            field.AccessibleName = heading;
            Controls.Add(field);
        }

        private Label LabelAt(string text, int x, int y, int width, int height, float size, FontStyle style, Color color)
        {
            Label label = new Label();
            label.Text = text;
            label.SetBounds(x, y, width, height);
            label.Font = new Font("Segoe UI", size, style);
            label.ForeColor = color;
            return label;
        }

        private void StyleButton(Button button, bool primary)
        {
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderColor = primary ? Color.FromArgb(242, 237, 226) : Color.FromArgb(74, 83, 96);
            button.BackColor = primary ? Color.FromArgb(242, 237, 226) : Color.FromArgb(20, 25, 32);
            button.ForeColor = primary ? Color.FromArgb(11, 14, 18) : Color.FromArgb(242, 237, 226);
            button.Cursor = Cursors.Hand;
        }
    }

    internal sealed class TrayContext : ApplicationContext
    {
        private const string Version = "0.4.0";
        private const string EditUrl = "https://dnd.faysk.dev/edit/";
        private const string ServiceUrl = "http://127.0.0.1:8765";
        private readonly string baseDir;
        private readonly string dataRoot;
        private readonly string pythonPath;
        private readonly string versionDir;
        private readonly NotifyIcon tray = new NotifyIcon();
        private readonly ToolStripMenuItem statusItem = new ToolStripMenuItem("Verificando…");
        private readonly ToolStripMenuItem progressItem = new ToolStripMenuItem();
        private readonly ToolStripMenuItem toggleItem = new ToolStripMenuItem("Iniciar serviço");
        private readonly ToolStripMenuItem updateItem = new ToolStripMenuItem("Atualizar componentes");
        private readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
        private readonly System.Windows.Forms.Timer qaTimer = new System.Windows.Forms.Timer();
        private bool polling;
        private bool updating;
        private Icon currentIcon;
        private CompanionState state = new CompanionState { Detail = "Verificando…" };

        public TrayContext()
        {
            string overrideBase = Environment.GetEnvironmentVariable("DND_SCRIBE_BASE_DIR");
            baseDir = String.IsNullOrWhiteSpace(overrideBase)
                ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DnDScribe")
                : Path.GetFullPath(overrideBase);
            dataRoot = ReadRequired(Path.Combine(baseDir, "data-root.txt"), "A pasta de dados não foi configurada. Execute o instalador novamente.");
            string installedVersion = ReadRequired(Path.Combine(baseDir, "current-version.txt"), "A versão instalada não foi encontrada. Execute o instalador novamente.");
            versionDir = Path.Combine(baseDir, "Companion", "versions", installedVersion);
            pythonPath = Path.Combine(baseDir, "Runtime", "versions", installedVersion, ".venv", "Scripts", "python.exe");

            ContextMenuStrip menu = new ContextMenuStrip();
            statusItem.Enabled = false;
            progressItem.Enabled = false;
            progressItem.Visible = false;
            menu.Items.Add(statusItem);
            menu.Items.Add(progressItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Abrir Edit", null, delegate { Open(EditUrl); });
            toggleItem.Click += async delegate { await ToggleService(); };
            menu.Items.Add(toggleItem);
            updateItem.Click += async delegate { await UpdateComponents(); };
            menu.Items.Add(updateItem);
            menu.Items.Add("Sobre", null, delegate { ShowAbout(); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Sair", null, async delegate { await ExitCompanion(); });

            tray.Text = "DnD Scribe · iniciando";
            tray.ContextMenuStrip = menu;
            tray.Visible = true;
            tray.DoubleClick += delegate { Open(EditUrl); };
            SetIcon(Color.FromArgb(220, 172, 89));

            timer.Interval = 2000;
            timer.Tick += async delegate { await Poll(); };
            timer.Start();
            bool showQaMenu = String.Equals(Environment.GetEnvironmentVariable("DND_SCRIBE_QA_MENU"), "1", StringComparison.Ordinal);
            bool showQaAbout = String.Equals(Environment.GetEnvironmentVariable("DND_SCRIBE_QA_ABOUT"), "1", StringComparison.Ordinal);
            if (showQaMenu || showQaAbout)
            {
                qaTimer.Interval = 600;
                qaTimer.Tick += delegate {
                    qaTimer.Stop();
                    if (showQaAbout) ShowAbout();
                    else tray.ContextMenuStrip.Show(new Point(200, 200));
                };
                qaTimer.Start();
            }
            Task.Run(async delegate {
                if (!await IsOnline()) StartService();
            });
            Task initialPoll = Poll();
        }

        private string ReadRequired(string path, string error)
        {
            if (!File.Exists(path)) throw new InvalidOperationException(error);
            string value = File.ReadAllText(path).Trim();
            if (String.IsNullOrWhiteSpace(value)) throw new InvalidOperationException(error);
            return value;
        }

        private async Task Poll()
        {
            if (polling || updating) return;
            polling = true;
            try
            {
                state = await Task.Run(delegate { return FetchState(); });
                Render();
            }
            finally { polling = false; }
        }

        private CompanionState FetchState()
        {
            CompanionState next = new CompanionState { Detail = "Serviço parado" };
            try
            {
                Dictionary<string, object> health = GetJson("/api/health") as Dictionary<string, object>;
                if (health == null) return next;
                next.Online = true;
                Dictionary<string, object> companion = ValueAsDictionary(health, "companion");
                next.ServiceVersion = ValueAsString(companion, "version");

                object sessionsValue = GetJson("/api/sessions");
                IEnumerable sessions = sessionsValue as IEnumerable;
                if (sessions != null)
                {
                    foreach (object item in sessions)
                    {
                        Dictionary<string, object> session = item as Dictionary<string, object>;
                        string status = ValueAsString(session, "status");
                        if (status != "queued" && status != "loading_model" && status != "transcribing") continue;
                        next.Processing = true;
                        Dictionary<string, object> progress = ValueAsDictionary(session, "progress");
                        next.Percent = Math.Max(0, Math.Min(99, ValueAsInt(progress, "percent")));
                        string speaker = ValueAsString(progress, "speaker");
                        string stage = ValueAsString(progress, "stage");
                        next.Detail = ProgressLabel(status, stage, speaker);
                        return next;
                    }
                }
                next.Percent = 100;
                next.Detail = "Serviço rodando";
                return next;
            }
            catch { return next; }
        }

        private object GetJson(string path)
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(ServiceUrl + path);
            request.Timeout = 1200;
            request.ReadWriteTimeout = 1200;
            request.Proxy = null;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream()))
                return new JavaScriptSerializer().DeserializeObject(reader.ReadToEnd());
        }

        private async Task<bool> IsOnline()
        {
            return await Task.Run(delegate {
                try { GetJson("/api/health"); return true; }
                catch { return false; }
            });
        }

        private string ProgressLabel(string status, string stage, string speaker)
        {
            if (status == "queued") return "Na fila";
            if (stage == "downloading_model") return "Baixando modelo";
            if (stage == "checking_model") return "Verificando modelo";
            if (stage == "loading_cuda") return "Carregando GPU";
            if (stage == "loading_cuda_fallback") return "Ajustando memória da GPU";
            if (stage == "loading_cpu") return "Carregando CPU";
            if (stage == "resuming") return "Reaproveitando faixa pronta";
            if (!String.IsNullOrWhiteSpace(speaker)) return "Transcrevendo " + speaker;
            return "Processando transcrição";
        }

        private void Render()
        {
            if (updating)
            {
                statusItem.Text = "● Atualizando componentes";
                progressItem.Text = "Aguarde…";
                progressItem.Visible = true;
                toggleItem.Enabled = false;
                updateItem.Enabled = false;
                tray.Text = "DnD Scribe · atualizando";
                SetIcon(Color.FromArgb(220, 172, 89));
                return;
            }
            toggleItem.Enabled = true;
            updateItem.Enabled = true;
            if (!state.Online)
            {
                statusItem.Text = "● Parado";
                progressItem.Visible = false;
                toggleItem.Text = "Iniciar serviço";
                tray.Text = "DnD Scribe · parado";
                SetIcon(Color.FromArgb(196, 81, 70));
            }
            else if (state.Processing)
            {
                statusItem.Text = "● Processando";
                progressItem.Text = state.Percent + "% · " + state.Detail;
                progressItem.Visible = true;
                toggleItem.Text = "Parar serviço";
                tray.Text = Truncate("DnD Scribe · " + state.Percent + "% · " + state.Detail, 63);
                SetIcon(Color.FromArgb(220, 172, 89));
            }
            else
            {
                statusItem.Text = "● Rodando";
                progressItem.Visible = false;
                toggleItem.Text = "Parar serviço";
                tray.Text = "DnD Scribe · rodando";
                SetIcon(Color.FromArgb(94, 197, 139));
            }
        }

        private async Task ToggleService()
        {
            if (state.Online) await StopService(); else StartService();
            await Task.Delay(700);
            await Poll();
        }

        private void StartService()
        {
            if (!File.Exists(pythonPath) || !Directory.Exists(versionDir))
                throw new InvalidOperationException("A instalação está incompleta. Execute o instalador novamente.");
            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = pythonPath;
            info.Arguments = "-m uvicorn app.main:app --app-dir " + Quote(versionDir) + " --host 127.0.0.1 --port 8765";
            info.WorkingDirectory = versionDir;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.WindowStyle = ProcessWindowStyle.Hidden;
            info.EnvironmentVariables["CRAIG_TO_TEXT_ROOT"] = dataRoot;
            Process.Start(info);
        }

        private async Task StopService()
        {
            string runtimeFile = Path.Combine(dataRoot, "companion-runtime.json");
            if (!File.Exists(runtimeFile)) return;
            try
            {
                Dictionary<string, object> runtime = new JavaScriptSerializer().DeserializeObject(File.ReadAllText(runtimeFile)) as Dictionary<string, object>;
                int pid = ValueAsInt(runtime, "pid");
                if (pid > 0)
                {
                    Process process = Process.GetProcessById(pid);
                    process.Kill();
                    await Task.Run(delegate { process.WaitForExit(5000); });
                }
            }
            catch { }
        }

        private async Task UpdateComponents()
        {
            if (MessageBox.Show("O serviço será reiniciado e as dependências locais desta versão serão reparadas. Continuar?", "Reparar componentes", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
            updating = true;
            Render();
            try
            {
                await StopService();
                await Task.Run(delegate {
                    Run(pythonPath, "-m pip install --upgrade pip==26.1.2 setuptools==83.0.0", 600000);
                    Run(pythonPath, "-m pip install --force-reinstall " + Quote(versionDir), 1800000);
                    Run(pythonPath, "-m pip check", 120000);
                });
                StartService();
                tray.ShowBalloonTip(4000, "DnD Scribe", "Componentes reparados e serviço reiniciado.", ToolTipIcon.Info);
            }
            catch (Exception error)
            {
                MessageBox.Show("Não foi possível reparar os componentes.\n\n" + error.Message, "Reparo incompleto", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                updating = false;
            }
            await Task.Delay(900);
            await Poll();
        }

        private void ShowAbout()
        {
            string serviceVersion = String.IsNullOrWhiteSpace(state.ServiceVersion) ? "serviço parado" : state.ServiceVersion;
            using (AboutForm dialog = new AboutForm(Version, serviceVersion, versionDir, dataRoot, pythonPath))
                dialog.ShowDialog();
        }

        private async Task ExitCompanion()
        {
            timer.Stop();
            await StopService();
            tray.Visible = false;
            tray.Dispose();
            if (currentIcon != null) currentIcon.Dispose();
            ExitThread();
        }

        private void Run(string fileName, string arguments, int timeoutMs)
        {
            ProcessStartInfo info = new ProcessStartInfo(fileName, arguments);
            info.WorkingDirectory = versionDir;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;
            using (Process process = Process.Start(info))
            {
                Task<string> output = process.StandardOutput.ReadToEndAsync();
                Task<string> error = process.StandardError.ReadToEndAsync();
                if (!process.WaitForExit(timeoutMs))
                {
                    process.Kill();
                    throw new TimeoutException("A atualização demorou além do esperado.");
                }
                Task.WaitAll(new Task[] { output, error }, 10000);
                if (process.ExitCode != 0) throw new InvalidOperationException((error.Result + Environment.NewLine + output.Result).Trim());
            }
        }

        private void SetIcon(Color color)
        {
            using (Bitmap bitmap = new Bitmap(16, 16))
            using (Graphics graphics = Graphics.FromImage(bitmap))
            {
                graphics.Clear(Color.Transparent);
                graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
                using (Brush outer = new SolidBrush(Color.FromArgb(20, 25, 32))) graphics.FillEllipse(outer, 0, 0, 15, 15);
                using (Brush inner = new SolidBrush(color)) graphics.FillEllipse(inner, 4, 4, 8, 8);
                IntPtr handle = bitmap.GetHicon();
                Icon icon = (Icon)Icon.FromHandle(handle).Clone();
                DestroyIcon(handle);
                tray.Icon = icon;
                if (currentIcon != null) currentIcon.Dispose();
                currentIcon = icon;
            }
        }

        private Dictionary<string, object> ValueAsDictionary(Dictionary<string, object> source, string key)
        {
            if (source == null || !source.ContainsKey(key)) return null;
            return source[key] as Dictionary<string, object>;
        }

        private string ValueAsString(Dictionary<string, object> source, string key)
        {
            if (source == null || !source.ContainsKey(key) || source[key] == null) return "";
            return Convert.ToString(source[key]);
        }

        private int ValueAsInt(Dictionary<string, object> source, string key)
        {
            if (source == null || !source.ContainsKey(key) || source[key] == null) return 0;
            try { return Convert.ToInt32(source[key]); }
            catch { return 0; }
        }

        private string Quote(string value) { return "\"" + value.Replace("\"", "\\\"") + "\""; }
        private string Truncate(string value, int length) { return value.Length <= length ? value : value.Substring(0, length - 1) + "…"; }
        private void Open(string target) { Process.Start(new ProcessStartInfo { FileName = target, UseShellExecute = true }); }

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern bool DestroyIcon(IntPtr handle);
    }

    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            if (args.Length == 1 && String.Equals(args[0], "/verify", StringComparison.OrdinalIgnoreCase)) return;
            bool created;
            using (Mutex mutex = new Mutex(true, "Local\\DnDScribeCompanionTray", out created))
            {
                if (!created) return;
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                try { Application.Run(new TrayContext()); }
                catch (Exception error) { MessageBox.Show(error.Message, "DnD Scribe Companion", MessageBoxButtons.OK, MessageBoxIcon.Error); }
            }
        }
    }
}
