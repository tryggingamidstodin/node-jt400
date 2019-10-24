package nodejt400;

import org.json.simple.JSONObject;

public class Props
{
  private final JSONObject w;

  public Props(JSONObject w)
  {
    this.w = w;
  }

  public boolean hasAny(String... keys)
  {
    for (String key : keys)
    {
      if (has(key))
        return true;
    }
    return false;
  }
  public boolean has(String key)
  {
    return w.get(key) != null;
  }

  public String getFirst(String... keys)
  {
    for (String key : keys)
    {
      if (has(key))
      {
        return get(key);
      }
    }
    return "";
  }
  public String get(String key)
  {
    return (String) w.get(key);
  }

  public int getFirstInt(String... keys)
  {
    for (String key : keys)
    {
      if (has(key))
        return getInt(key);
    }
    throw new RuntimeException("missing attribute: " + keys);
  }

  public int getInt(String key)
  {
    return ((Number) w.get(key)).intValue();
  }

  public String get(String key, String defaultValue)
  {
    String value = (String) w.get(key);
    return value == null ? defaultValue : value;
  }
}