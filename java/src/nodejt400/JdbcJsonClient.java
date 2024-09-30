package nodejt400;

import java.math.BigDecimal;
import java.sql.*;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

import java.io.StringReader;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import java.util.Base64;
import java.lang.IllegalArgumentException;

public class JdbcJsonClient
{
	private final ConnectionProvider pool;

	public JdbcJsonClient(ConnectionProvider pool)
	{
		this.pool = pool;
	}

	public String query(String sql, String paramsJson, boolean trim)
			throws Exception
	{
		Connection c = pool.getConnection();
		PreparedStatement st = null;
		JSONArray array = new JSONArray();
		try
		{
			JSONArray params = parseParams(paramsJson);
			st = c.prepareStatement(sql);
			setParams(params, st);
			st.setQueryTimeout(10);
			ResultSet rs = st.executeQuery();
			ResultSetMetaData metaData = rs.getMetaData();
			while (rs.next())
			{
				JSONObject json = new JSONObject();
				int columnCount = metaData.getColumnCount();
				for (int i = 1; i <= columnCount; i++)
				{
					String typeName = metaData.getColumnTypeName(i);
					switch (typeName) {
						case "BOOLEAN":
						case "BIT":
							boolean booleanValue = rs.getBoolean(i);
							json.put(metaData.getColumnLabel(i), booleanValue);
							break;
						case "TINYINT":
						case "SMALLINT":
							short shortValue = rs.getShort(i);
							json.put(metaData.getColumnLabel(i), shortValue);
							break;
						case "INTEGER":
							int intValue = rs.getInt(i);
							json.put(metaData.getColumnLabel(i), intValue);
							break;
						case "BIGINT":
							long longValue = rs.getLong(i);
							json.put(metaData.getColumnLabel(i), longValue);
							break;
						case "FLOAT":
						case "REAL":
							float floatValue = rs.getFloat(i);
							json.put(metaData.getColumnLabel(i), floatValue);
							break;
						case "DOUBLE":
							double doubleValue = rs.getDouble(i);
							json.put(metaData.getColumnLabel(i), doubleValue);
							break;
						case "NUMERIC":
						case "DECIMAL":
							BigDecimal bigDecimalValue = rs.getBigDecimal(i);
							json.put(metaData.getColumnLabel(i), bigDecimalValue);
							break;
						case "CHAR":
						case "VARCHAR":
						case "LONGVARCHAR":
						case "NCHAR":
						case "NVARCHAR":
						case "LONGNVARCHAR":
						case "DATE":
						case "TIME":
						case "TIMESTAMP":
							String stringValue = rs.getString(i);
							if(trim) {
								json.put(metaData.getColumnLabel(i), trim(stringValue));
							} else {
								json.put(metaData.getColumnLabel(i), stringValue);
							}
							break;
						case "BINARY":
						case "VARBINARY":
						case "LONGVARBINARY":
						case "BLOB":
							Blob blob = rs.getBlob(i);
							if (blob != null) {
								byte[] originalFileBytes = blob.getBytes(1, (int) blob.length());
								byte[] base64Bytes = Base64.getEncoder().encode(originalFileBytes);
								String text = new String(base64Bytes, StandardCharsets.UTF_8);
								json.put(metaData.getColumnLabel(i), text);
							} else {
								json.put(metaData.getColumnLabel(i), null);
							}
							break;
						default:
							if(trim) {
								json.put(metaData.getColumnLabel(i), trim(rs.getString(i)));
							} else {
								json.put(metaData.getColumnLabel(i), rs.getString(i));
							}
							break;
					}
				}
				array.add(json);
			}
		}
		catch (Exception e)
		{
			throw e;
		}
		finally
		{
			if (st != null)
				st.close();
			pool.returnConnection(c);
		}

		return array.toJSONString();
	}

	public ResultStream queryAsStream(String sql, String paramsJson, int bufferSize)
			throws Exception {
		Connection c = pool.getConnection();
		PreparedStatement st = null;
		try {
			JSONArray params = parseParams(paramsJson);
			st = c.prepareStatement(sql);
			setParams(params, st);
			ResultSet rs = st.executeQuery();
			return new ResultStream(pool, c, st, rs, bufferSize);
		} catch (Exception e) {
			throw e;
		}
	}

	public StatementWrap execute(String sql, String paramsJson)
		throws Exception
	{
		Connection c = pool.getConnection();
		PreparedStatement st = null;
		try
		{
			JSONArray params = parseParams(paramsJson);
			st = c.prepareStatement(sql);
			setParams(params, st);
			return new StatementWrap(pool, c, st);
		}
		catch (Exception e)
		{
			if(st!=null) {
				st.close();
			}
			pool.returnConnection(c);
			throw e;
		}
	}

	public TablesReadStream getTablesAsStream(String catalog, String schema, String tableNamePattern) throws Exception
	{
		Connection c = pool.getConnection();
		try
		{
			return new TablesReadStream(c, catalog, schema, tableNamePattern);
		}
		catch (Exception e)
		{
			pool.returnConnection(c);
			throw e;
		}
	}

	public String getColumns(String catalog, String schema, String tableNamePattern, String columnNamePattern)
	throws Exception
	{
		Connection c = pool.getConnection();
		try
		{
			JSONArray columns = new JSONArray();
			ResultSet crs = c.getMetaData().getColumns(catalog, schema, tableNamePattern, columnNamePattern);
			while(crs.next())
			{
				JSONObject column = new JSONObject();
				columns.add(column);
				column.put("name", crs.getString(4));
				column.put("typeName", crs.getString(6));
				column.put("precision", crs.getInt(7));
				column.put("scale", crs.getInt(9));
				String remarks = crs.getString(12);
				if (remarks != null)
				{
					column.put("remarks", remarks);
				}
			}
			crs.close();
			pool.returnConnection(c);
			return columns.toJSONString();
		}
		catch (Exception e)
		{
			pool.returnConnection(c);
			throw e;
		}
	}

	public String getPrimaryKeys(String catalog, String schema, String table)
	throws Exception
	{
		Connection c = pool.getConnection();
		try
		{
			JSONArray columns = new JSONArray();
			ResultSet crs = c.getMetaData().getPrimaryKeys(catalog, schema, table);
			while(crs.next())
			{
				JSONObject column = new JSONObject();
				columns.add(column);
				column.put("name", crs.getString(4));
			}
			crs.close();
			pool.returnConnection(c);
			return columns.toJSONString();
		}
		catch (Exception e)
		{
			pool.returnConnection(c);
			throw e;
		}
	}

	public static final String trim(String value)
	{
		return value == null ? null : value.trim();
	}

	public int update(String sql, String paramsJson)
			throws Exception
	{
		Connection c = pool.getConnection();
		PreparedStatement st = null;
		int result = 0;
		try
		{
			JSONArray params = parseParams(paramsJson);
			st = c.prepareStatement(sql);
			setParams(params, st);
			result = st.executeUpdate();
		}
		catch (Exception e)
		{
			throw e;
		}
		finally
		{
			if (st != null)
				st.close();
			pool.returnConnection(c);
		}
		return result;
	}

	public int[] batchUpdate(String sql, String paramsListJson)
			throws Exception {
		Connection c = pool.getConnection();
		PreparedStatement st = null;
		int[] result = null;
		try {
			st = c.prepareStatement(sql);
			JSONArray jsonArray = (JSONArray) JSONValue.parse(paramsListJson);
			int n = jsonArray.size();
			for (int i = 0; i < n; i++) {
				JSONArray params = (JSONArray) jsonArray.get(i);
				setParams(params, st);
				st.addBatch();
			}
			result = st.executeBatch();
		} catch (Exception e) {
			throw e;
		} finally {
			if (st != null)
				st.close();
			pool.returnConnection(c);
		}
		return result;
	}

	public double insertAndGetId(String sql, String paramsJson)
			throws Exception
	{
		Connection c = pool.getConnection();
		PreparedStatement st = null;
		double result = 0;
		try
		{
			JSONArray params = parseParams(paramsJson);
			st = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
			setParams(params, st);
			st.executeUpdate();
			ResultSet keys = st.getGeneratedKeys();
			if (keys.next())
			{
				result = keys.getDouble(1);
			}
		}
		catch (Exception e)
		{
			throw e;
		}
		finally
		{
			if (st != null)
				st.close();
			pool.returnConnection(c);
		}
		return result;
	}

	private void setParams(JSONArray params, PreparedStatement st)
			throws Exception
	{
		int n = params.size();

		for (int i = 0; i < n; i++)
		{
			Object value = params.get(i);

			try
			{
				if (value instanceof JSONObject) {
					JSONObject obj = (JSONObject)value;					

					String objType = (String) obj.get("type");
					String objValue = (String) obj.get("value");

					if ("CLOB".equals(objType)) {
						StringReader reader = new StringReader(objValue);
						st.setClob(i + 1, reader, objValue.length());
					} else if ("BLOB".equals(objType)) {
						// Data gets sent as base64
						byte[] base64Bytes = objValue.getBytes(StandardCharsets.UTF_8);
						byte[] originalFileBytes = Base64.getDecoder().decode(base64Bytes);
						ByteArrayInputStream stream = new ByteArrayInputStream(originalFileBytes);
						st.setBlob(i + 1, stream, originalFileBytes.length);
					}
				}
				else if (value instanceof Long)
				{
					st.setLong(i + 1, (Long) value);
				}
				else if (value instanceof Double)
				{
					st.setDouble(i + 1, (Double) value);
				}
				else if (value == null)
				{
					st.setNull(i + 1, Types.VARCHAR);
				}
				else
				{
					st.setString(i + 1, value.toString());
				}
			}
			catch (SQLException e)
			{
				throw e;
			}
			catch (IllegalArgumentException e)
			{
				throw e;
			}
		}
	}

	private JSONArray parseParams(String paramsJson)
	{
		return (JSONArray) JSONValue.parse(paramsJson);
	}
}
