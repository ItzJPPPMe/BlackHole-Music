package downloader

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"

	"github.com/ender-downloader/compiler/internal/utils"
)

type Downloader struct {
	OutputDir string
}

type VideoInfo struct {
	Title    string `json:"title"`
	Duration string `json:"duration_string"`
	Format   string `json:"format"`
	URL      string
}

type PlaylistInfo struct {
	Title      string          `json:"title"`
	URL        string          `json:"url"`
	TrackCount int             `json:"track_count"`
	Tracks     []PlaylistTrack `json:"tracks"`
}

type PlaylistTrack struct {
	Index    int    `json:"index"`
	Title    string `json:"title"`
	URL      string `json:"url"`
	Duration string `json:"duration"`
	Uploader string `json:"uploader"`
}

func New(outputDir string) *Downloader {
	return &Downloader{OutputDir: outputDir}
}

func (d *Downloader) Start(url string) error {
	if !utils.IsValidURL(url) {
		return fmt.Errorf("geçersiz URL: %s", url)
	}

	if err := utils.EnsureDir(d.OutputDir); err != nil {
		return fmt.Errorf("klasör oluşturulamadı: %w", err)
	}

	cmd := exec.Command("yt-dlp",
		"-f", "bestvideo+bestaudio/best",
		"--no-playlist",
		"-o", utils.JoinPath(d.OutputDir, "%(title)s.%(ext)s"),
		url,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("indirme hatası: %s", string(output))
	}

	return nil
}

func (d *Downloader) GetInfo(url string) (*VideoInfo, error) {
	cmd := exec.Command("yt-dlp",
		"--dump-json",
		"--no-playlist",
		url,
	)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("video bilgisi alınamadı: %s", stderr.String())
	}

	var info VideoInfo
	if err := json.Unmarshal(stdout.Bytes(), &info); err != nil {
		return nil, fmt.Errorf("JSON ayrıştırma hatası: %w", err)
	}

	info.URL = url
	return &info, nil
}

func (d *Downloader) StartWithQuality(url, quality, format, folder string) error {
	if !utils.IsValidURL(url) {
		return fmt.Errorf("geçersiz URL: %s", url)
	}

	outputDir := folder
	if outputDir == "" {
		outputDir = d.OutputDir
	}

	if err := utils.EnsureDir(outputDir); err != nil {
		return fmt.Errorf("klasör oluşturulamadı: %w", err)
	}

	args := buildArgs(url, quality, format, outputDir)
	cmd := exec.Command("yt-dlp", args...)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("indirme hatası: %s", string(output))
	}

	return nil
}

func (d *Downloader) StartPlaylist(url, quality, format, folder string, albumStructure bool) error {
	if !utils.IsValidURL(url) {
		return fmt.Errorf("geçersiz URL: %s", url)
	}

	outputDir := folder
	if outputDir == "" {
		outputDir = d.OutputDir
	}

	if err := utils.EnsureDir(outputDir); err != nil {
		return fmt.Errorf("klasör oluşturulamadı: %w", err)
	}

	args := buildPlaylistArgs(url, quality, format, outputDir, albumStructure)
	cmd := exec.Command("yt-dlp", args...)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("playlist indirme hatası: %s", string(output))
	}

	return nil
}

func (d *Downloader) GetPlaylistInfo(url string) (*PlaylistInfo, error) {
	cmd := exec.Command("yt-dlp",
		"--dump-json",
		"--flat-playlist",
		"--no-download",
		url,
	)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("playlist bilgisi alınamadı: %s", stderr.String())
	}

	lines := strings.Split(strings.TrimSpace(stdout.String()), "\n")
	var tracks []PlaylistTrack
	var title string

	for i, line := range lines {
		var item map[string]interface{}
		if err := json.Unmarshal([]byte(line), &item); err != nil {
			continue
		}

		if i == 0 {
			if t, ok := item["title"].(string); ok {
				title = t
			}
		}

		track := PlaylistTrack{
			Index: i + 1,
		}
		if t, ok := item["title"].(string); ok {
			track.Title = t
		}
		if u, ok := item["url"].(string); ok {
			track.URL = u
		}
		if d, ok := item["duration_string"].(string); ok {
			track.Duration = d
		}
		if u, ok := item["uploader"].(string); ok {
			track.Uploader = u
		}
		tracks = append(tracks, track)
	}

	return &PlaylistInfo{
		Title:      title,
		URL:        url,
		TrackCount: len(tracks),
		Tracks:     tracks,
	}, nil
}

func buildArgs(url, quality, format, outputDir string) []string {
	args := []string{"--no-playlist"}

	switch quality {
	case "1080":
		args = append(args, "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]")
	case "720":
		args = append(args, "-f", "bestvideo[height<=720]+bestaudio/best[height<=720]")
	case "480":
		args = append(args, "-f", "bestvideo[height<=480]+bestaudio/best[height<=480]")
	default:
		switch format {
		case "mp3", "flac", "wav", "aac", "ogg":
			args = append(args, "-f", "bestaudio/best")
		case "webm":
			args = append(args, "-f", "bestvideo[ext=webm]+bestaudio/best")
		default:
			args = append(args, "-f", "bestvideo+bestaudio/best")
		}
	}

	switch format {
	case "mp3", "flac", "wav", "aac", "ogg":
		args = append(args, "--extract-audio", "--audio-format", format)
		args = append(args, "--embed-thumbnail", "--add-metadata")
		outputTemplate := utils.JoinPath(outputDir, "%(title)s.%(ext)s")
		args = append(args, "-o", outputTemplate)
	default:
		outputTemplate := utils.JoinPath(outputDir, "%(title)s.%(ext)s")
		args = append(args, "-o", outputTemplate)
	}

	args = append(args, url)
	return args
}

func buildPlaylistArgs(url, quality, format, outputDir string, albumStructure bool) []string {
	args := []string{
		"--yes-playlist",
		"--no-overwrites",
		"--ignore-errors",
	}

	switch quality {
	case "1080":
		args = append(args, "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]")
	case "720":
		args = append(args, "-f", "bestvideo[height<=720]+bestaudio/best[height<=720]")
	case "480":
		args = append(args, "-f", "bestvideo[height<=480]+bestaudio/best[height<=480]")
	default:
		switch format {
		case "mp3", "flac", "wav", "aac", "ogg":
			args = append(args, "-f", "bestaudio/best")
		default:
			args = append(args, "-f", "bestvideo+bestaudio/best")
		}
	}

	switch format {
	case "mp3", "flac", "wav", "aac", "ogg":
		args = append(args, "--extract-audio", "--audio-format", format)
		args = append(args, "--embed-thumbnail", "--add-metadata", "--xattrs")

		if albumStructure {
			outputTemplate := utils.JoinPath(outputDir, "%(uploader)s", "%(playlist_title)s", "%(playlist_index)s - %(title)s.%(ext)s")
			args = append(args, "-o", outputTemplate)
		} else {
			outputTemplate := utils.JoinPath(outputDir, "%(title)s.%(ext)s")
			args = append(args, "-o", outputTemplate)
		}
	default:
		outputTemplate := utils.JoinPath(outputDir, "%(playlist_title)s", "%(title)s.%(ext)s")
		args = append(args, "-o", outputTemplate)
	}

	args = append(args, url)
	return args
}

func (d *Downloader) ListFormats(url string) (string, error) {
	cmd := exec.Command("yt-dlp", "--list-formats", url)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("format listesi alınamadı: %s", stderr.String())
	}

	return strings.TrimSpace(stdout.String()), nil
}

type StreamInfo struct {
	Title      string `json:"title"`
	URL        string `json:"url"`
	Platform   string `json:"platform"`
	Streamer   string `json:"streamer"`
	Duration   string `json:"duration"`
	Date       string `json:"date"`
	Thumbnail  string `json:"thumbnail"`
}

func DetectPlatform(url string) string {
	if strings.Contains(url, "youtube.com") || strings.Contains(url, "youtu.be") {
		return "youtube"
	}
	if strings.Contains(url, "twitch.tv") {
		return "twitch"
	}
	if strings.Contains(url, "kick.com") {
		return "kick"
	}
	return "other"
}

func (d *Downloader) GetStreamInfo(url string) (*StreamInfo, error) {
	cmd := exec.Command("yt-dlp", "--dump-json", "--no-download", url)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("yayın bilgisi alınamadı: %s", stderr.String())
	}

	var data map[string]interface{}
	if err := json.Unmarshal(stdout.Bytes(), &data); err != nil {
		return nil, fmt.Errorf("JSON ayrıştırma hatası: %w", err)
	}

	platform := DetectPlatform(url)
	info := &StreamInfo{
		URL:      url,
		Platform: platform,
	}
	if t, ok := data["title"].(string); ok {
		info.Title = t
	}
	if u, ok := data["uploader"].(string); ok {
		info.Streamer = u
	}
	if d, ok := data["duration_string"].(string); ok {
		info.Duration = d
	}
	if d, ok := data["upload_date"].(string); ok {
		info.Date = d
	}
	if t, ok := data["thumbnail"].(string); ok {
		info.Thumbnail = t
	}

	return info, nil
}

func (d *Downloader) StartStream(url, quality, format, folder string) error {
	if !utils.IsValidURL(url) {
		return fmt.Errorf("geçersiz URL: %s", url)
	}

	outputDir := folder
	if outputDir == "" {
		outputDir = d.OutputDir
	}

	if err := utils.EnsureDir(outputDir); err != nil {
		return fmt.Errorf("klasör oluşturulamadı: %w", err)
	}

	platform := DetectPlatform(url)
	args := buildStreamArgs(url, quality, format, outputDir, platform)
	cmd := exec.Command("yt-dlp", args...)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("yayın indirme hatası: %s", string(output))
	}

	return nil
}

func buildStreamArgs(url, quality, format, outputDir, platform string) []string {
	args := []string{
		"--no-overwrites",
		"--no-playlist",
		"--embed-thumbnail",
		"--add-metadata",
	}

	if platform == "twitch" {
		args = append(args, "--concurrent-fragments", "4")
	}

	switch quality {
	case "1080":
		args = append(args, "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]")
	case "720":
		args = append(args, "-f", "bestvideo[height<=720]+bestaudio/best[height<=720]")
	case "480":
		args = append(args, "-f", "bestvideo[height<=480]+bestaudio/best[height<=480]")
	default:
		args = append(args, "-f", "bestvideo+bestaudio/best")
	}

	switch format {
	case "mp3", "flac", "wav", "aac", "ogg":
		args = append(args, "--extract-audio", "--audio-format", format)
	}

	switch platform {
	case "youtube":
		args = append(args, "-o", utils.JoinPath(outputDir, "YouTube - %(title)s.%(ext)s"))
	case "twitch":
		args = append(args, "-o", utils.JoinPath(outputDir, "Twitch - %(uploader)s - %(title)s.%(ext)s"))
	case "kick":
		args = append(args, "-o", utils.JoinPath(outputDir, "Kick - %(uploader)s - %(title)s.%(ext)s"))
	default:
		args = append(args, "-o", utils.JoinPath(outputDir, "%(title)s.%(ext)s"))
	}

	args = append(args, url)
	return args
}
