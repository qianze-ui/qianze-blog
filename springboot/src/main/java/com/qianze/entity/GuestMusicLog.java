package com.qianze.entity;

import java.time.LocalDateTime;

public class GuestMusicLog {
    private Long id;
    private String ip;
    private String country;
    private String province;
    private String city;
    private String browser;
    private String os;
    private String device;
    private String model;
    private String songTitle;
    private String songArtist;
    private String songUrl;
    private String source;
    private LocalDateTime createdAt;

    public GuestMusicLog() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getIp() { return ip; }
    public void setIp(String ip) { this.ip = ip; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getProvince() { return province; }
    public void setProvince(String province) { this.province = province; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getBrowser() { return browser; }
    public void setBrowser(String browser) { this.browser = browser; }
    public String getOs() { return os; }
    public void setOs(String os) { this.os = os; }
    public String getDevice() { return device; }
    public void setDevice(String device) { this.device = device; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public String getSongTitle() { return songTitle; }
    public void setSongTitle(String songTitle) { this.songTitle = songTitle; }
    public String getSongArtist() { return songArtist; }
    public void setSongArtist(String songArtist) { this.songArtist = songArtist; }
    public String getSongUrl() { return songUrl; }
    public void setSongUrl(String songUrl) { this.songUrl = songUrl; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
