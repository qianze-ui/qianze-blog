package com.qianze.mapper;

import com.qianze.entity.Song;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface SongMapper {
    @Select("SELECT * FROM songs ORDER BY sort_order, id")
    @Results({
        @Result(property = "songId", column = "song_id"),
        @Result(property = "playUrl", column = "play_url"),
        @Result(property = "lyricUrl", column = "lyric_url"),
        @Result(property = "sourceType", column = "source_type"),
        @Result(property = "playCount", column = "play_count"),
        @Result(property = "sortOrder", column = "sort_order"),
        @Result(property = "createTime", column = "create_time")
    })
    List<Song> findAll();

    @Select("SELECT * FROM songs WHERE id = #{id}")
    @Results({
        @Result(property = "songId", column = "song_id"),
        @Result(property = "playUrl", column = "play_url"),
        @Result(property = "lyricUrl", column = "lyric_url"),
        @Result(property = "sourceType", column = "source_type"),
        @Result(property = "playCount", column = "play_count"),
        @Result(property = "sortOrder", column = "sort_order"),
        @Result(property = "createTime", column = "create_time")
    })
    Song findById(Long id);

    @Select("SELECT * FROM songs WHERE song_id = #{songId} LIMIT 1")
    @Results({
        @Result(property = "songId", column = "song_id"),
        @Result(property = "playUrl", column = "play_url"),
        @Result(property = "lyricUrl", column = "lyric_url"),
        @Result(property = "sourceType", column = "source_type"),
        @Result(property = "playCount", column = "play_count"),
        @Result(property = "sortOrder", column = "sort_order"),
        @Result(property = "createTime", column = "create_time")
    })
    Song findBySongId(Long songId);

    @Insert("INSERT INTO songs (song_id, title, artist, album, url, play_url, cover, lyric_url, duration, source_type, play_count, sort_order, create_time) " +
            "VALUES (#{songId}, #{title}, #{artist}, #{album}, #{url}, #{playUrl}, #{cover}, #{lyricUrl}, #{duration}, #{sourceType}, #{playCount}, #{sortOrder}, NOW())")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insert(Song song);

    @Update("UPDATE songs SET song_id=#{songId}, title=#{title}, artist=#{artist}, album=#{album}, url=#{url}, " +
            "play_url=#{playUrl}, cover=#{cover}, lyric_url=#{lyricUrl}, duration=#{duration}, " +
            "source_type=#{sourceType}, sort_order=#{sortOrder} WHERE id=#{id}")
    void update(Song song);

    @Update("UPDATE songs SET play_count = play_count + 1 WHERE id = #{id}")
    void incrementPlayCount(Long id);

    @Delete("DELETE FROM songs WHERE id=#{id}")
    void deleteById(Long id);
}
