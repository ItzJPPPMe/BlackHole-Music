package formatter

import (
	"fmt"
	"os/exec"
)

type Converter struct{}

func NewConverter() *Converter {
	return &Converter{}
}

func (c *Converter) ConvertToMP4(inputPath, outputPath string) error {
	cmd := exec.Command("ffmpeg", "-i", inputPath, "-c:v", "copy", "-c:a", "aac", "-y", outputPath)
	return cmd.Run()
}

func (c *Converter) ConvertToMP3(inputPath, outputPath string, bitrate string) error {
	if bitrate == "" {
		bitrate = "192k"
	}
	cmd := exec.Command("ffmpeg", "-i", inputPath, "-vn", "-ab", bitrate, "-ar", "44100", "-y", outputPath)
	return cmd.Run()
}

func (c *Converter) ConvertToFLAC(inputPath, outputPath string) error {
	cmd := exec.Command("ffmpeg", "-i", inputPath, "-vn", "-c:a", "flac", "-y", outputPath)
	return cmd.Run()
}

func (c *Converter) ConvertToWAV(inputPath, outputPath string) error {
	cmd := exec.Command("ffmpeg", "-i", inputPath, "-vn", "-c:a", "pcm_s16le", "-ar", "44100", "-y", outputPath)
	return cmd.Run()
}

func (c *Converter) ConvertToAAC(inputPath, outputPath string) error {
	cmd := exec.Command("ffmpeg", "-i", inputPath, "-vn", "-c:a", "aac", "-b:a", "192k", "-y", outputPath)
	return cmd.Run()
}

func (c *Converter) ConvertToOGG(inputPath, outputPath string) error {
	cmd := exec.Command("ffmpeg", "-i", inputPath, "-vn", "-c:a", "libvorbis", "-q:a", "4", "-y", outputPath)
	return cmd.Run()
}

func (c *Converter) Convert(inputPath, outputPath, format string) error {
	switch format {
	case "mp4":
		return c.ConvertToMP4(inputPath, outputPath)
	case "mp3":
		return c.ConvertToMP3(inputPath, outputPath, "192k")
	case "flac":
		return c.ConvertToFLAC(inputPath, outputPath)
	case "wav":
		return c.ConvertToWAV(inputPath, outputPath)
	case "aac":
		return c.ConvertToAAC(inputPath, outputPath)
	case "ogg":
		return c.ConvertToOGG(inputPath, outputPath)
	default:
		return fmt.Errorf("desteklenmeyen format: %s", format)
	}
}
