package nodejt400;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;

public class StatementWrap
{
  private ConnectionProvider connectionProvider;
  private Connection c;
  private PreparedStatement st;
  private boolean isQuery;
  private ResultSet rs;
  private int updated = -1;

  public StatementWrap(ConnectionProvider connectionProvider, Connection c, PreparedStatement st)
  throws Exception
  {
    this.connectionProvider = connectionProvider;
    this.c = c;
    this.st = st;
    isQuery = st.execute();
    if(isQuery)
    {
      rs = st.getResultSet();
    }
  }

  public boolean isQuery()
  {
    return isQuery;
  }

  public void close() throws Exception
  {
    if(rs != null)
    {
      rs.close();
    }
    st.close();
    connectionProvider.returnConnection(c);
  }

  public int updated()
  throws Exception
  {
    if(updated != -1)
    {
      return updated;
    }

    try
    {
      updated = st.getUpdateCount();
      return updated;
    }
    catch(Exception e)
    {
      throw e;
    }
    finally
    {
      close();
    }
  }

  public String getMetaData() throws Exception
  {
    try
    {
      ResultSetMetaData metaData = rs.getMetaData();
      int columnCount = metaData.getColumnCount();
      JSONArray columns = new JSONArray();
      for (int i = 1; i <= columnCount; i++)
      {
        JSONObject column = new JSONObject();
        columns.add(column);
        column.put("name", metaData.getColumnName(i));
        column.put("typeName", metaData.getColumnTypeName(i));
        column.put("precision", metaData.getPrecision(i));
        column.put("scale", metaData.getScale(i));
      }
      return columns.toJSONString();
    }
    catch(Exception e)
    {
      close();
      throw e;
    }
  }

  public ResultStream asStream(int bufferSize)
  throws Exception
  {
    return new ResultStream(connectionProvider, c, st, rs, bufferSize);
  }
}