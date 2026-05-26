package com.qianze.entity;

import java.time.LocalDateTime;

public class Song {
    private Long id;
    private Long songId;
    private String title;
    private String artist;
    private String album;
    private String url;
    private String playUrl;
    private String cover;
    private String lyricUrl;
    private Integer duration;
    private String sourceType;
    private Integer playCount;
    private Integer sortOrder;
    private LocalDateTime createTime;

    public Song() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getSongId() { return songId; }
    public void setSongId(Long songId) { this.songId = songId; }
    public String getPlayUrl() { return playUrl; }
    public void setPlayUrl(String playUrl) { this.playUrl = playUrl; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getArtist() { return artist; }
    public void setArtist(String artist) { this.artist = artist; }
    public String getAlbum() { return album; }
    public void setAlbum(String album) { this.album = album; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getCover() { return cover; }
    public void setCover(String cover) { this.cover = cover; }
    public String getLyricUrl() { return lyricUrl; }
    public void setLyricUrl(String lyricUrl) { this.lyricUrl = lyricUrl; }
    public Integer getDuration() { return duration; }
    public void setDuration(Integer duration) { this.duration = duration; }
    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
    public Integer getPlayCount() { return playCount; }
    public void setPlayCount(Integer playCount) { this.playCount = playCount; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
