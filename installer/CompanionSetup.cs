using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace DnDScribe.CompanionSetup
{
    internal sealed class PythonCommand
    {
        public string FileName;
        public string Prefix;
    }

    internal sealed class SetupForm : Form
    {
        private const string Version = "0.4.0";
        private const string PayloadResource = "DnDScribe.CompanionPayload.zip";
        private const string TrayResource = "DnDScribe.CompanionTray.exe";
        private readonly TextBox dataRoot = new TextBox();
        private readonly TextBox log = new TextBox();
        private readonly Button installButton = new Button();
        private readonly Button browseButton = new Button();

        public SetupForm()
        {
            Text = "DnD Scribe Companion";
            ClientSize = new Size(720, 560);
            MinimumSize = new Size(640, 520);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(11, 14, 18);
            ForeColor = Color.FromArgb(242, 237, 226);
            Font = new Font("Segoe UI", 10F);

            Label eyebrow = LabelAt("DND SCRIBE · WINDOWS", 34, 28, 620, 22, 9F, FontStyle.Bold, Color.FromArgb(220, 172, 89));
            Label title = LabelAt("Processamento local, sem enviar áudio.", 32, 58, 650, 76, 25F, FontStyle.Bold, ForeColor);
            Label copy = LabelAt(
                "O instalador prepara o companion, CUDA via Python e um atalho no seu Desktop. " +
                "Na primeira transcrição, o modelo Whisper será baixado para este computador.",
                34, 142, 640, 62, 10F, FontStyle.Regular, Color.FromArgb(174, 183, 196));

            Label folderLabel = LabelAt("PASTA DOS ZIPS, ÁUDIOS E TRANSCRIÇÕES", 34, 220, 620, 22, 8F, FontStyle.Bold, Color.FromArgb(220, 172, 89));
            dataRoot.SetBounds(34, 248, 532, 34);
            dataRoot.Text = ExistingDataRoot() ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "DnD Scribe");
            dataRoot.AccessibleName = "Pasta de dados do DnD Scribe";
            dataRoot.BackColor = Color.FromArgb(20, 25, 32);
            dataRoot.ForeColor = ForeColor;
            dataRoot.BorderStyle = BorderStyle.FixedSingle;

            browseButton.Text = "Escolher…";
            browseButton.SetBounds(578, 246, 108, 38);
            StyleButton(browseButton, false);
            browseButton.Click += Browse;

            installButton.Text = "Instalar e abrir o Edit";
            installButton.SetBounds(34, 304, 260, 46);
            StyleButton(installButton, true);
            installButton.Click += Install;

            Label note = LabelAt(
                "Reserve cerca de 12 GB no disco do Windows e espaço para os ZIPs na pasta escolhida. " +
                "O serviço escuta apenas em 127.0.0.1.",
                312, 304, 374, 48, 9F, FontStyle.Regular, Color.FromArgb(174, 183, 196));

            log.SetBounds(34, 376, 652, 142);
            log.Multiline = true;
            log.ReadOnly = true;
            log.AccessibleName = "Progresso da instalação";
            log.ScrollBars = ScrollBars.Vertical;
            log.BackColor = Color.FromArgb(16, 20, 26);
            log.ForeColor = Color.FromArgb(194, 204, 217);
            log.BorderStyle = BorderStyle.FixedSingle;
            log.Text = "Pronto para instalar a versão " + Version + "." + Environment.NewLine;

            Controls.AddRange(new Control[] {
                eyebrow, title, copy, folderLabel, dataRoot, browseButton,
                installButton, note, log
            });
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

        private void Browse(object sender, EventArgs eventArgs)
        {
            using (FolderBrowserDialog dialog = new FolderBrowserDialog())
            {
                dialog.Description = "Escolha onde o DnD Scribe guardará ZIPs, áudios, modelos e transcrições.";
                dialog.SelectedPath = dataRoot.Text;
                dialog.ShowNewFolderButton = true;
                if (dialog.ShowDialog(this) == DialogResult.OK) dataRoot.Text = dialog.SelectedPath;
            }
        }

        private async void Install(object sender, EventArgs eventArgs)
        {
            string selectedRoot;
            try
            {
                selectedRoot = Path.GetFullPath(Environment.ExpandEnvironmentVariables(dataRoot.Text.Trim()));
                Directory.CreateDirectory(selectedRoot);
            }
            catch (Exception error)
            {
                MessageBox.Show(this, "Escolha uma pasta válida.\n\n" + error.Message, "Pasta inválida", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            installButton.Enabled = false;
            browseButton.Enabled = false;
            try
            {
                await Task.Run(delegate { InstallCompanion(selectedRoot); });
                Append("Instalação concluída. Abrindo o DnD Scribe…");
                MessageBox.Show(
                    this,
                    "Companion instalado. O controlador ficará junto ao relógio do Windows e iniciará com o seu login.\n\n" +
                    "Na primeira execução, permita ao Chrome acessar a rede local.",
                    "Tudo pronto",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                Close();
            }
            catch (Exception error)
            {
                Append("ERRO: " + error.Message);
                MessageBox.Show(this, error.Message, "Não foi possível instalar", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                installButton.Enabled = true;
                browseButton.Enabled = true;
            }
        }

        private void InstallCompanion(string selectedRoot)
        {
            string baseDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DnDScribe");
            string versionsDir = Path.Combine(baseDir, "Companion", "versions");
            string versionDir = Path.Combine(versionsDir, Version);
            string stagingDir = versionDir + ".installing";
            string runtimeVersionsDir = Path.Combine(baseDir, "Runtime", "versions");
            string runtimeVersionDir = Path.Combine(runtimeVersionsDir, Version);
            string runtimeStagingDir = runtimeVersionDir + ".installing";
            string venvDir = Path.Combine(runtimeStagingDir, ".venv");
            Directory.CreateDirectory(versionsDir);
            Directory.CreateDirectory(runtimeVersionsDir);

            Append("Encerrando a versão anterior, se estiver aberta…");
            StopExistingCompanion(baseDir, selectedRoot);
            string legacyLauncher = Path.Combine(baseDir, "Iniciar DnD Scribe Companion.cmd");
            if (File.Exists(legacyLauncher)) File.Delete(legacyLauncher);

            Append("Preparando os arquivos do companion…");
            SafeDelete(stagingDir, baseDir);
            Directory.CreateDirectory(stagingDir);
            ExtractPayload(stagingDir);
            SafeDelete(versionDir, baseDir);
            Directory.Move(stagingDir, versionDir);

            Append("Procurando Python 3.11 ou 3.12…");
            PythonCommand python = FindPython();
            if (python == null)
            {
                Append("Python não encontrado. Instalando Python 3.12 com o Windows Package Manager…");
                try
                {
                    Run("winget.exe", "install --exact --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements", null, 900000);
                }
                catch (Exception error)
                {
                    throw new InvalidOperationException(
                        "Não foi possível instalar o Python automaticamente. Instale o Python 3.12 pelo site python.org, marque a opção de adicionar ao PATH e execute este instalador novamente.\n\n" + error.Message,
                        error);
                }
                python = FindPython();
            }
            if (python == null) throw new InvalidOperationException("Python 3.11 ou 3.12 não foi encontrado. Instale o Python e execute este instalador novamente.");

            Append("Criando o ambiente Python isolado desta versão…");
            SafeDelete(runtimeStagingDir, baseDir);
            Directory.CreateDirectory(runtimeStagingDir);
            Run(python.FileName, JoinArgs(python.Prefix, "-m venv " + Quote(venvDir)), null, 300000);
            string stagingPython = Path.Combine(venvDir, "Scripts", "python.exe");

            Append("Instalando o motor de transcrição e as bibliotecas CUDA. Isso pode levar alguns minutos…");
            Run(stagingPython, "-m pip install --upgrade pip==26.1.2 setuptools==83.0.0", null, 600000);
            Run(stagingPython, "-m pip install " + Quote(versionDir), null, 1800000);

            Append("Validando o ambiente isolado antes de ativar a versão…");
            Run(stagingPython, "-m pip check", versionDir, 120000);
            Run(
                stagingPython,
                "-c \"import ctranslate2, faster_whisper, fastapi; print('runtime-ok', ctranslate2.__version__)\"",
                versionDir,
                120000);

            SafeDelete(runtimeVersionDir, baseDir);
            Directory.Move(runtimeStagingDir, runtimeVersionDir);
            string venvPython = Path.Combine(runtimeVersionDir, ".venv", "Scripts", "python.exe");
            if (!File.Exists(venvPython)) throw new InvalidOperationException("O ambiente Python isolado não foi ativado corretamente.");

            string trayPath = InstallTray(baseDir);
            File.WriteAllText(Path.Combine(baseDir, "data-root.txt"), selectedRoot);
            File.WriteAllText(Path.Combine(baseDir, "current-version.txt"), Version);
            CreateShortcut(
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "DnD Scribe Companion.lnk"),
                trayPath);
            CreateShortcut(
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "DnD Scribe Companion.lnk"),
                trayPath);

            Append("Iniciando o controlador junto ao relógio…");
            Process.Start(new ProcessStartInfo {
                FileName = trayPath,
                WorkingDirectory = baseDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            });
            Process.Start(new ProcessStartInfo {
                FileName = "https://dnd.faysk.dev/edit/",
                UseShellExecute = true
            });
        }

        private void ExtractPayload(string destination)
        {
            Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(PayloadResource);
            if (stream == null) throw new InvalidOperationException("O instalador está sem o pacote interno do companion.");
            using (stream)
            using (ZipArchive archive = new ZipArchive(stream, ZipArchiveMode.Read))
            {
                foreach (ZipArchiveEntry entry in archive.Entries)
                {
                    string target = Path.GetFullPath(Path.Combine(destination, entry.FullName));
                    string root = Path.GetFullPath(destination) + Path.DirectorySeparatorChar;
                    if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Pacote interno inválido.");
                    if (String.IsNullOrEmpty(entry.Name))
                    {
                        Directory.CreateDirectory(target);
                    }
                    else
                    {
                        Directory.CreateDirectory(Path.GetDirectoryName(target));
                        using (Stream input = entry.Open())
                        using (FileStream output = File.Create(target)) input.CopyTo(output);
                    }
                }
            }
        }

        private PythonCommand FindPython()
        {
            PythonCommand[] candidates = new PythonCommand[] {
                new PythonCommand { FileName = "py.exe", Prefix = "-3.12" },
                new PythonCommand { FileName = "py.exe", Prefix = "-3.11" },
                new PythonCommand { FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Python", "Python312", "python.exe"), Prefix = "" },
                new PythonCommand { FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Python", "Python311", "python.exe"), Prefix = "" },
                new PythonCommand { FileName = "python.exe", Prefix = "" }
            };
            foreach (PythonCommand candidate in candidates)
            {
                try
                {
                    string output = Run(candidate.FileName, JoinArgs(candidate.Prefix, "-c \"import sys; assert (3, 11) <= sys.version_info[:2] < (3, 13); print(sys.executable)\""), null, 20000);
                    if (!String.IsNullOrWhiteSpace(output)) return candidate;
                }
                catch { }
            }
            return null;
        }

        private string Run(string fileName, string arguments, string workingDirectory, int timeoutMs)
        {
            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = fileName;
            info.Arguments = arguments;
            info.WorkingDirectory = workingDirectory ?? Environment.CurrentDirectory;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;
            using (Process process = Process.Start(info))
            {
                Task<string> stdoutTask = process.StandardOutput.ReadToEndAsync();
                Task<string> stderrTask = process.StandardError.ReadToEndAsync();
                if (!process.WaitForExit(timeoutMs))
                {
                    try { process.Kill(); } catch { }
                    throw new TimeoutException("A instalação demorou além do esperado em: " + fileName);
                }
                Task.WaitAll(new Task[] { stdoutTask, stderrTask }, 10000);
                string stdout = stdoutTask.Result;
                string stderr = stderrTask.Result;
                if (process.ExitCode != 0) throw new InvalidOperationException((stderr + Environment.NewLine + stdout).Trim());
                return stdout.Trim();
            }
        }

        private string InstallTray(string baseDir)
        {
            string target = Path.Combine(baseDir, "DnDScribeCompanion.exe");
            string temporary = target + ".installing";
            using (Stream input = Assembly.GetExecutingAssembly().GetManifestResourceStream(TrayResource))
            {
                if (input == null) throw new InvalidOperationException("O instalador está sem o controlador da bandeja.");
                using (FileStream output = File.Create(temporary)) input.CopyTo(output);
            }
            if (File.Exists(target)) File.Delete(target);
            File.Move(temporary, target);
            return target;
        }

        private string ExistingDataRoot()
        {
            try
            {
                string config = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DnDScribe", "data-root.txt");
                if (!File.Exists(config)) return null;
                string value = File.ReadAllText(config).Trim();
                return String.IsNullOrWhiteSpace(value) ? null : value;
            }
            catch { return null; }
        }

        private void CreateShortcut(string shortcutPath, string targetPath)
        {
            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            object shell = Activator.CreateInstance(shellType);
            object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
            Type shortcutType = shortcut.GetType();
            shortcutType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { targetPath });
            shortcutType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { Path.GetDirectoryName(targetPath) });
            shortcutType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { "Iniciar o DnD Scribe Companion" });
            shortcutType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
        }

        private void StopExistingCompanion(string baseDir, string selectedRoot)
        {
            foreach (Process process in Process.GetProcessesByName("DnDScribeCompanion"))
            {
                try { process.Kill(); process.WaitForExit(5000); } catch { }
            }

            string runtimeFile = Path.Combine(selectedRoot, "companion-runtime.json");
            if (File.Exists(runtimeFile))
            {
                Match match = Regex.Match(File.ReadAllText(runtimeFile), "\\\"pid\\\"\\s*:\\s*(\\d+)");
                if (match.Success) StopPythonProcess(Int32.Parse(match.Groups[1].Value), baseDir);
            }

            try
            {
                string netstat = Run("netstat.exe", "-ano -p tcp", null, 20000);
                foreach (string line in netstat.Split(new char[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries))
                {
                    if (line.IndexOf("127.0.0.1:8765", StringComparison.OrdinalIgnoreCase) < 0 || line.IndexOf("LISTENING", StringComparison.OrdinalIgnoreCase) < 0) continue;
                    string[] parts = Regex.Split(line.Trim(), "\\s+");
                    int pid;
                    if (parts.Length > 0 && Int32.TryParse(parts[parts.Length - 1], out pid)) StopPythonProcess(pid, baseDir);
                }
            }
            catch { }

            foreach (Process process in Process.GetProcessesByName("cmd"))
            {
                try
                {
                    if (String.Equals(process.MainWindowTitle, "DnD Scribe Companion", StringComparison.OrdinalIgnoreCase)) process.Kill();
                }
                catch { }
            }
        }

        private void StopPythonProcess(int pid, string baseDir)
        {
            try
            {
                Process process = Process.GetProcessById(pid);
                string executable = process.MainModule.FileName;
                string allowed = Path.GetFullPath(Path.Combine(baseDir, "Runtime")) + Path.DirectorySeparatorChar;
                if (!Path.GetFullPath(executable).StartsWith(allowed, StringComparison.OrdinalIgnoreCase)) return;
                process.Kill();
                process.WaitForExit(5000);
            }
            catch { }
        }

        private void SafeDelete(string target, string baseDir)
        {
            string resolved = Path.GetFullPath(target);
            string allowed = Path.GetFullPath(baseDir) + Path.DirectorySeparatorChar;
            if (!resolved.StartsWith(allowed, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Destino de instalação inválido.");
            if (Directory.Exists(resolved)) Directory.Delete(resolved, true);
        }

        private string JoinArgs(string prefix, string arguments)
        {
            return String.IsNullOrWhiteSpace(prefix) ? arguments : prefix + " " + arguments;
        }

        private string Quote(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }

        private void Append(string message)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<string>(Append), message);
                return;
            }
            log.AppendText("[" + DateTime.Now.ToString("HH:mm:ss") + "] " + message + Environment.NewLine);
        }
    }

    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            if (args.Length == 1 && String.Equals(args[0], "/verify", StringComparison.OrdinalIgnoreCase))
            {
                Environment.ExitCode = VerifyPayload() ? 0 : 2;
                return;
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }

        private static bool VerifyPayload()
        {
            try
            {
                using (Stream tray = Assembly.GetExecutingAssembly().GetManifestResourceStream("DnDScribe.CompanionTray.exe"))
                using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("DnDScribe.CompanionPayload.zip"))
                using (ZipArchive archive = new ZipArchive(stream, ZipArchiveMode.Read))
                {
                    if (tray == null || tray.Length == 0) return false;
                    bool hasApplication = false;
                    bool hasProject = false;
                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        string name = entry.FullName.Replace('\\', '/');
                        if (name == "app/main.py") hasApplication = true;
                        if (name == "pyproject.toml") hasProject = true;
                    }
                    return hasApplication && hasProject;
                }
            }
            catch { return false; }
        }
    }
}
